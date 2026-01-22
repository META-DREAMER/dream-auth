import fs from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Redact credentials from a PostgreSQL connection string for safe logging
 */
function redactConnectionString(connectionString: string): string {
	try {
		const url = new URL(connectionString);
		if (url.password) {
			url.password = "***";
		}
		return url.toString();
	} catch {
		return connectionString.replace(/:[^:@]+@/, ":***@");
	}
}

/**
 * Global setup for E2E tests
 *
 * Playwright's globalSetup runs in a SEPARATE worker process. Any process.env
 * changes here are isolated to this worker and NOT inherited by the main
 * Playwright process or its webServer child process.
 *
 * Solution: Write the dynamic DATABASE_URL to .env.test.local, which Vite
 * automatically loads when started with --mode test (higher priority than .env.test).
 *
 * Static config (BETTER_AUTH_SECRET, etc.) lives in .env.test.
 */
async function globalSetup(_config: FullConfig) {
	console.log("[E2E Setup] Starting PostgreSQL container...");

	const container = await new PostgreSqlContainer("postgres:16-alpine")
		.withDatabase("e2e_auth")
		.withUsername("test")
		.withPassword("test")
		.start();

	const connectionString = container.getConnectionUri();
	console.log(
		"[E2E Setup] PostgreSQL started:",
		redactConnectionString(connectionString),
	);

	// Write DATABASE_URL to .env.test.local
	// Vite automatically loads .env.[mode].local with highest priority
	const envPath = path.resolve(process.cwd(), ".env.test.local");
	fs.writeFileSync(envPath, `DATABASE_URL=${connectionString}\n`);
	console.log("[E2E Setup] DATABASE_URL written to .env.test.local");

	// Store references for teardown
	(globalThis as Record<string, unknown>).__E2E_CONTAINER__ = container;
	(globalThis as Record<string, unknown>).__E2E_ENV_PATH__ = envPath;

	console.log("[E2E Setup] Global setup complete");
}

export default globalSetup;
