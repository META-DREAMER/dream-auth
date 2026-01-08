import fs from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

// Store reference for teardown
let container: StartedPostgreSqlContainer | null = null;

/**
 * Global setup for E2E tests
 *
 * 1. Starts PostgreSQL container via testcontainers
 * 2. Writes environment variables to a file for the webServer to use
 *
 * The dev server is started by Playwright's webServer config
 */
async function globalSetup(_config: FullConfig) {
	const port = process.env.E2E_PORT || "3001";
	const baseUrl = `http://localhost:${port}`;

	console.log("[E2E Setup] Starting PostgreSQL container...");

	// Start PostgreSQL container
	container = await new PostgreSqlContainer("postgres:16-alpine")
		.withDatabase("e2e_auth")
		.withUsername("test")
		.withPassword("test")
		.start();

	const connectionString = container.getConnectionUri();
	console.log("[E2E Setup] PostgreSQL started:", connectionString);

	// Create environment file for the dev server
	const envContent = `
DATABASE_URL=${connectionString}
NODE_ENV=test
SKIP_ENV_VALIDATION=true
BETTER_AUTH_SECRET=test-secret-at-least-32-characters-long-for-testing
BETTER_AUTH_URL=${baseUrl}
BETTER_AUTH_AUTO_MIGRATE=true
ENABLE_REGISTRATION=true
ENABLE_OIDC_PROVIDER=true
ENABLE_PASSKEYS=true
ENABLE_SIWE=true
OIDC_REQUIRE_PKCE=true
OIDC_CLIENTS=${JSON.stringify([
		{
			clientId: "test-client",
			clientSecret: "test-secret",
			name: "Test Client",
			type: "web",
			redirectURLs: [`${baseUrl}/callback`],
			skipConsent: false,
		},
		{
			clientId: "trusted-client",
			clientSecret: "trusted-secret",
			name: "Trusted Client",
			type: "web",
			redirectURLs: [`${baseUrl}/callback`],
			skipConsent: true,
		},
	])}
`.trim();

	// Write to .env.e2e for the dev server
	const envPath = path.resolve(process.cwd(), ".env.e2e.local");
	fs.writeFileSync(envPath, envContent);
	console.log("[E2E Setup] Environment written to", envPath);

	// Store container reference for teardown
	(globalThis as Record<string, unknown>).__E2E_CONTAINER__ = container;
	(globalThis as Record<string, unknown>).__E2E_ENV_PATH__ = envPath;

	console.log(
		"[E2E Setup] Global setup complete - webServer will start the dev server",
	);
}

export default globalSetup;
