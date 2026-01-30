import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Global setup for integration tests.
 *
 * This runs BEFORE any test files are loaded, allowing us to set up
 * the database container and write connection info to a file that
 * setup-db.ts can read synchronously at module load time.
 *
 * This solves the timing issue where env vars evaluated at module load
 * time (like `const skipIfNoDb = !process.env.INTEGRATION_TEST_DB_READY`)
 * would see undefined values because beforeAll hooks run after modules load.
 */

const STATE_FILE = join(__dirname, ".test-db-state.json");

let container: StartedPostgreSqlContainer;

export async function setup() {
	console.log("[Global Setup] Starting PostgreSQL container...");

	container = await new PostgreSqlContainer("postgres:16-alpine")
		.withDatabase("test_auth")
		.withUsername("test")
		.withPassword("test")
		.start();

	const connectionString = container.getConnectionUri();

	// Write state to file for setup-db.ts to read synchronously
	writeFileSync(STATE_FILE, JSON.stringify({ connectionString }));

	console.log("[Global Setup] PostgreSQL container started:", connectionString);

	// Return teardown function
	return async () => {
		console.log("[Global Teardown] Stopping PostgreSQL container...");
		await container.stop();
		if (existsSync(STATE_FILE)) {
			unlinkSync(STATE_FILE);
		}
		console.log("[Global Teardown] PostgreSQL container stopped");
	};
}
