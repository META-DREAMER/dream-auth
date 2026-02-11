import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

/**
 * Database setup for integration tests using Testcontainers
 *
 * This file reads the database connection info written by global-setup.ts
 * SYNCHRONOUSLY at module load time. This ensures env vars are set before
 * test files evaluate their skip conditions.
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

const STATE_FILE = join(__dirname, ".test-db-state.json");

let pool: Pool | undefined;

// Read state SYNCHRONOUSLY at module load time (before tests load)
// This is critical: the global-setup.ts runs before test files are loaded,
// so by the time this module loads, the state file should exist.
if (existsSync(STATE_FILE)) {
	const state = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
	process.env.DATABASE_URL = state.connectionString;
	process.env.TEST_DATABASE_URL = state.connectionString;
	process.env.INTEGRATION_TEST_DB_READY = "true";
	process.env.BETTER_AUTH_AUTO_MIGRATE = "true";

	pool = new Pool({ connectionString: state.connectionString });

	console.log("[Test DB] Loaded database connection from global setup");
} else {
	console.warn(
		"[Test DB] State file not found - database may not be available",
	);
}

// Note: Test isolation is handled by individual tests with explicit cleanup
// (e.g., DELETE FROM table in beforeEach). Transaction-based isolation was
// removed because tests use pool.query() which gets different connections
// from the pool, making per-connection transactions ineffective.

// Export for use in tests
export { pool };
