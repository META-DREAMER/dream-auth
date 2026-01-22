import fs from "node:fs";
import type { FullConfig } from "@playwright/test";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Global teardown for E2E tests
 *
 * 1. Stops the PostgreSQL container started by global setup
 * 2. Removes the .env.test.local file created by global setup
 */
async function globalTeardown(_config: FullConfig) {
	console.log("[E2E Teardown] Starting cleanup...");

	const container = (globalThis as Record<string, unknown>).__E2E_CONTAINER__ as
		| StartedPostgreSqlContainer
		| undefined;
	const envPath = (globalThis as Record<string, unknown>).__E2E_ENV_PATH__ as
		| string
		| undefined;

	if (container) {
		console.log("[E2E Teardown] Stopping PostgreSQL container...");
		await container.stop();
		console.log("[E2E Teardown] Container stopped");
	}

	// Clean up .env.test.local
	if (envPath && fs.existsSync(envPath)) {
		fs.unlinkSync(envPath);
		console.log("[E2E Teardown] Removed .env.test.local");
	}

	console.log("[E2E Teardown] Cleanup complete");
}

export default globalTeardown;
