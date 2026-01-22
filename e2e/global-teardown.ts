import type { FullConfig } from "@playwright/test";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Global teardown for E2E tests
 *
 * Stops the PostgreSQL container started by global setup.
 */
async function globalTeardown(_config: FullConfig) {
	console.log("[E2E Teardown] Starting cleanup...");

	const container = (globalThis as Record<string, unknown>).__E2E_CONTAINER__ as
		| StartedPostgreSqlContainer
		| undefined;

	if (container) {
		console.log("[E2E Teardown] Stopping PostgreSQL container...");
		await container.stop();
		console.log("[E2E Teardown] Container stopped");
	}

	console.log("[E2E Teardown] Cleanup complete");
}

export default globalTeardown;
