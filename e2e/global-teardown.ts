import type { ChildProcess } from "node:child_process";
import type { FullConfig } from "@playwright/test";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Global teardown for E2E tests
 *
 * 1. Stops the web server spawned by global setup
 * 2. Stops the PostgreSQL container started by global setup
 */
async function globalTeardown(_config: FullConfig) {
	console.log("[E2E Teardown] Starting cleanup...");

	// Stop web server first
	const server = (globalThis as Record<string, unknown>).__E2E_SERVER__ as
		| ChildProcess
		| undefined;

	if (server) {
		console.log("[E2E Teardown] Stopping web server...");
		server.kill("SIGTERM");
		await new Promise<void>((resolve) => {
			if (server.exitCode !== null) return resolve();
			server.once("exit", () => resolve());
			setTimeout(() => resolve(), 5000).unref?.();
		});
		console.log("[E2E Teardown] Web server stopped");
	}

	// Stop PostgreSQL container
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
