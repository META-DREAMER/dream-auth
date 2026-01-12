import fs from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import {
	configToEnvFile,
	configToEnvVars,
	getE2ETestConfig,
} from "./test-config";

// Store reference for teardown
let container: StartedPostgreSqlContainer | null = null;

/**
 * Global setup for E2E tests
 *
 * 1. Loads test configuration from test-config.ts (can be overridden by env vars)
 * 2. Starts PostgreSQL container via testcontainers
 * 3. Sets complete configuration in process.env (inherited by webServer)
 * 4. Writes configuration to .env.test.local (fallback for Vite)
 *
 * The dev server is started by Playwright's webServer config
 */
async function globalSetup(_config: FullConfig) {
	console.log("[E2E Setup] Starting PostgreSQL container...");

	// Start PostgreSQL container
	container = await new PostgreSqlContainer("postgres:16-alpine")
		.withDatabase("e2e_auth")
		.withUsername("test")
		.withPassword("test")
		.start();

	const connectionString = container.getConnectionUri();
	console.log("[E2E Setup] PostgreSQL started:", connectionString);

	// Get test configuration and inject dynamic DATABASE_URL
	process.env.DATABASE_URL = connectionString;
	const config = getE2ETestConfig();

	// Apply all configuration to process.env for webServer and workers
	const envVars = configToEnvVars(config);
	for (const [key, value] of Object.entries(envVars)) {
		process.env[key] = value;
	}

	console.log(
		"[E2E Setup] Environment variables configured from test-config.ts",
	);

	// Write to .env.test.local as fallback for Vite
	const envPath = path.resolve(process.cwd(), ".env.test.local");
	fs.writeFileSync(envPath, configToEnvFile(config));
	console.log("[E2E Setup] Environment written to", envPath);

	// Store references for teardown and worker access
	(globalThis as Record<string, unknown>).__E2E_CONTAINER__ = container;
	(globalThis as Record<string, unknown>).__E2E_ENV_PATH__ = envPath;
	(globalThis as Record<string, unknown>).__E2E_DATABASE_URL__ =
		connectionString;

	console.log(
		"[E2E Setup] Global setup complete - webServer will start the dev server",
	);
}

export default globalSetup;
