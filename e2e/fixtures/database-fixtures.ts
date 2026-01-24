import { test as base } from "@playwright/test";
import { Pool } from "pg";

/**
 * Database fixtures for E2E tests
 *
 * Provides access to the PostgreSQL database for seeding and cleanup.
 * Uses the connection string set by global-setup.ts
 */

let globalPool: Pool | null = null;

function getPool(): Pool {
	if (!globalPool) {
		// Try process.env first, then fall back to globalThis (set by global-setup.ts)
		const connectionString =
			process.env.DATABASE_URL ||
			((globalThis as Record<string, unknown>).__E2E_DATABASE_URL__ as
				| string
				| undefined);
		if (!connectionString) {
			throw new Error(
				"DATABASE_URL not set. Make sure global-setup.ts ran successfully.",
			);
		}
		globalPool = new Pool({ connectionString });
	}
	return globalPool;
}

export type DatabaseFixtures = {
	/**
	 * Database pool for direct queries
	 * Use for seeding test data and cleanup
	 */
	pool: Pool;

	/**
	 * Clean up specific tables after a test
	 */
	cleanupTables: (tables: string[]) => Promise<void>;
};

export const databaseFixtures = base.extend<DatabaseFixtures>({
	// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture pattern requires destructuring
	pool: async ({}, use) => {
		const pool = getPool();
		await use(pool);
		// Pool is kept alive across tests (worker-scoped cleanup happens in global teardown)
	},

	cleanupTables: async ({ pool }, use) => {
		const cleanup = async (tables: string[]) => {
			// Use spread to avoid mutating the input array
			for (const table of [...tables].reverse()) {
				await pool.query(`TRUNCATE TABLE "${table}" CASCADE`);
			}
		};

		await use(cleanup);
	},
});
