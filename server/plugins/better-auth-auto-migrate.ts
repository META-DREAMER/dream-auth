import { getMigrations } from "better-auth/db";
import { Pool } from "pg";
import { serverEnv } from "@/env";
import { auth } from "@/lib/auth";

/**
 * Better Auth Auto-Migration Plugin for Nitro
 *
 * Safely runs Better Auth database migrations at server startup.
 * Designed for Kubernetes/GitOps deployments with multiple replicas.
 *
 * Safety features:
 * - PostgreSQL advisory lock prevents concurrent migrations across pods
 * - Only runs additive migrations (Better Auth never drops columns/tables)
 * - Skips entirely if no migrations are needed (no lock contention)
 * - Detailed logging for GitOps audit trails
 * - Configurable via environment variables
 */

interface MigrationTable {
	table: string;
	fields: Record<string, unknown>;
	order?: number;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireAdvisoryLockWithTimeout(
	client: import("pg").PoolClient,
	lockKey: string,
	timeoutMs: number,
): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;

	while (true) {
		const res = await client.query<{ locked: boolean }>(
			'SELECT pg_try_advisory_lock(hashtext($1)) AS "locked"',
			[lockKey],
		);

		if (res.rows[0]?.locked) {
			return true;
		}

		if (Date.now() >= deadline) {
			return false;
		}

		// Keep this low-frequency to avoid hammering Postgres on pod stampedes
		await sleep(1000);
	}
}

function formatMigrationSummary(
	toBeCreated: MigrationTable[],
	toBeAdded: MigrationTable[],
): string {
	const lines: string[] = [];

	if (toBeCreated.length > 0) {
		lines.push(`  Tables to create (${toBeCreated.length}):`);
		for (const table of toBeCreated) {
			const fieldNames = Object.keys(table.fields);
			lines.push(
				`    - ${table.table} (${fieldNames.length} columns: ${fieldNames.join(", ")})`,
			);
		}
	}

	if (toBeAdded.length > 0) {
		lines.push(`  Columns to add (${toBeAdded.length} tables):`);
		for (const table of toBeAdded) {
			const fieldNames = Object.keys(table.fields);
			lines.push(`    - ${table.table}: ${fieldNames.join(", ")}`);
		}
	}

	return lines.join("\n");
}

export default async () => {
	if (!serverEnv.BETTER_AUTH_AUTO_MIGRATE) {
		return;
	}

	const lockKey = serverEnv.BETTER_AUTH_MIGRATION_LOCK_KEY;
	const timeoutMs = serverEnv.BETTER_AUTH_MIGRATION_LOCK_TIMEOUT_MS;

	console.log(
		"[BetterAuth] Auto-migrate enabled. Checking for pending migrations...",
	);

	// First, check if there are any migrations to run BEFORE acquiring lock
	// This avoids lock contention when the database is already up-to-date
	const migrationInfo = await getMigrations(auth.options);
	const { toBeCreated, toBeAdded } = migrationInfo;

	const hasMigrations = toBeCreated.length > 0 || toBeAdded.length > 0;

	if (!hasMigrations) {
		console.log(
			"[BetterAuth] Database schema is up-to-date. No migrations needed.",
		);
		return;
	}

	// Log what migrations will be applied (for GitOps audit trail)
	console.log("[BetterAuth] Pending migrations detected:");
	console.log(formatMigrationSummary(toBeCreated, toBeAdded));

	// Now acquire lock and run migrations
	const pool = new Pool({
		connectionString: serverEnv.DATABASE_URL,
	});
	const client = await pool.connect();

	let locked = false;
	try {
		console.log(
			`[BetterAuth] Waiting for migration lock (timeout: ${timeoutMs}ms)...`,
		);

		locked = await acquireAdvisoryLockWithTimeout(client, lockKey, timeoutMs);
		if (!locked) {
			throw new Error(
				`[BetterAuth] Timed out waiting for migration lock after ${timeoutMs}ms (key: ${lockKey})`,
			);
		}

		console.log("[BetterAuth] Migration lock acquired.");

		// Re-check migrations after acquiring lock (another pod may have run them)
		const freshMigrationInfo = await getMigrations(auth.options);
		const freshHasMigrations =
			freshMigrationInfo.toBeCreated.length > 0 ||
			freshMigrationInfo.toBeAdded.length > 0;

		if (!freshHasMigrations) {
			console.log(
				"[BetterAuth] Another instance already applied migrations. Schema is now up-to-date.",
			);
			return;
		}

		console.log("[BetterAuth] Running migrations...");
		const startTime = Date.now();

		await freshMigrationInfo.runMigrations();

		const duration = Date.now() - startTime;
		console.log(
			`[BetterAuth] Migrations completed successfully in ${duration}ms.`,
		);
	} finally {
		if (locked) {
			try {
				await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
					lockKey,
				]);
				console.log("[BetterAuth] Migration lock released.");
			} catch (error) {
				console.error("[BetterAuth] Failed to release migration lock:", error);
			}
		}

		client.release();
		await pool.end();
	}
};
