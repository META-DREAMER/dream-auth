import { test as base } from "@playwright/test";
import { Pool, type PoolClient } from "pg";

/**
 * Database fixtures for E2E tests
 *
 * Provides access to the PostgreSQL database for seeding and cleanup.
 * Uses the connection string set by global-setup.ts
 */

let globalPool: Pool | null = null;

function getPool(): Pool {
	if (!globalPool) {
		const connectionString = process.env.DATABASE_URL;
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
	 * Use for seeding test data
	 */
	pool: Pool;

	/**
	 * Transaction-scoped client for test isolation
	 * All changes are rolled back after each test
	 */
	dbClient: PoolClient;

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

	dbClient: async ({ pool }, use) => {
		const client = await pool.connect();
		await client.query("BEGIN");

		await use(client);

		// Rollback transaction to clean up test data
		await client.query("ROLLBACK");
		client.release();
	},

	cleanupTables: async ({ pool }, use) => {
		const cleanup = async (tables: string[]) => {
			// Truncate in reverse order to handle foreign key constraints
			for (const table of tables.reverse()) {
				await pool.query(`TRUNCATE TABLE "${table}" CASCADE`);
			}
		};

		await use(cleanup);
	},
});
