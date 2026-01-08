import fs from "node:fs";
import type { FullConfig } from "@playwright/test";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Global teardown for E2E tests
 *
 * 1. Stops the PostgreSQL container
 * 2. Cleans up the environment file
 */
async function globalTeardown(_config: FullConfig) {
	console.log("[E2E Teardown] Starting cleanup...");

	const container = (globalThis as Record<string, unknown>).__E2E_CONTAINER__ as
		| StartedPostgreSqlContainer
		| undefined;
	const envPath = (globalThis as Record<string, unknown>).__E2E_ENV_PATH__ as
		| string
		| undefined;

	// Stop the PostgreSQL container
	if (container) {
		console.log("[E2E Teardown] Stopping PostgreSQL container...");
		await container.stop();
	}

	// Clean up the environment file
	if (envPath && fs.existsSync(envPath)) {
		console.log("[E2E Teardown] Removing environment file...");
		fs.unlinkSync(envPath);
	}

	console.log("[E2E Teardown] Cleanup complete");
}

export default globalTeardown;
