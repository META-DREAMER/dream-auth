import path from "node:path";
import type { FullConfig } from "@playwright/test";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { config as dotenvConfig } from "dotenv";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

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
 * 1. Loads static defaults from .env.e2e.defaults (before any other env access)
 * 2. Starts PostgreSQL container via testcontainers
 * 3. Sets dynamic env vars (DATABASE_URL, BETTER_AUTH_URL, OIDC_CLIENTS)
 *
 * The webServer inherits process.env at spawn time (after this runs).
 * Vite should not override existing process.env values.
 */
async function globalSetup(_config: FullConfig) {
	// 1. Load static defaults FIRST (before any other env access)
	dotenvConfig({ path: path.resolve(__dirname, ".env.e2e.defaults") });
	console.log("[E2E Setup] Loaded static environment defaults");

	// 2. Start PostgreSQL container
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

	// 3. Set dynamic env vars
	// DATABASE_URL comes from the container
	// BETTER_AUTH_URL and OIDC_CLIENTS are set here to ensure they override .env file values
	// Vite should not override process.env vars that are already set
	const port = process.env.E2E_PORT || "3001";
	const baseUrl = `http://localhost:${port}`;

	process.env.DATABASE_URL = connectionString;
	process.env.BETTER_AUTH_URL = baseUrl;
	process.env.PORT = port;

	// Set OIDC clients (must match what .env.test has, but we set here to ensure override)
	process.env.OIDC_CLIENTS = JSON.stringify([
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
	]);

	console.log("[E2E Setup] Environment variables configured");

	// 5. Store container reference for teardown
	(globalThis as Record<string, unknown>).__E2E_CONTAINER__ = container;

	console.log(
		"[E2E Setup] Global setup complete - webServer will inherit process.env",
	);
}

export default globalSetup;
