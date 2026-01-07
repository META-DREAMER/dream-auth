import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

/**
 * Database setup for integration tests using Testcontainers
 *
 * Usage: Import this file in integration tests that need a real PostgreSQL database
 *
 * Example:
 * ```ts
 * import "../../../test/setup-db";
 * import { pool } from "../../../test/setup-db";
 *
 * describe("my integration test", () => {
 *   it("should work with database", async () => {
 *     const result = await pool.query("SELECT 1");
 *     expect(result.rows[0]).toBeDefined();
 *   });
 * });
 * ```
 */

let container: StartedPostgreSqlContainer;
let pool: Pool;

// Global database container setup
beforeAll(async () => {
	console.log("[Test DB] Starting PostgreSQL container...");

	container = await new PostgreSqlContainer("postgres:16-alpine")
		.withDatabase("test_auth")
		.withUsername("test")
		.withPassword("test")
		.start();

	const connectionString = container.getConnectionUri();
	process.env.DATABASE_URL = connectionString;
	process.env.TEST_DATABASE_URL = connectionString;

	pool = new Pool({ connectionString });

	// Run BetterAuth migrations to set up schema
	// Enable auto-migrate for test setup
	process.env.BETTER_AUTH_AUTO_MIGRATE = "true";

	console.log("[Test DB] PostgreSQL container started:", connectionString);

	// Note: BetterAuth migrations will run when auth module is imported
	// in the actual test files that need the database
}, 120000); // 120s timeout for container startup

afterAll(async () => {
	console.log("[Test DB] Stopping PostgreSQL container...");

	if (pool) {
		await pool.end();
	}
	if (container) {
		await container.stop();
	}

	console.log("[Test DB] PostgreSQL container stopped");
});

// Transaction-based cleanup between tests
let testClient: import("pg").PoolClient | null = null;

beforeEach(async () => {
	if (pool) {
		testClient = await pool.connect();
		await testClient.query("BEGIN");
	}
});

afterEach(async () => {
	if (testClient) {
		await testClient.query("ROLLBACK");
		testClient.release();
		testClient = null;
	}
});

// Export for use in tests
export { pool, container };
