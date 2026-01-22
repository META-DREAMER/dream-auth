import { type ChildProcess, spawn } from "node:child_process";
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
 * Wait for a URL to become ready (return 2xx-4xx status)
 */
async function waitForUrlReady(url: string, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;

	while (Date.now() < deadline) {
		try {
			const res = await fetch(url, { redirect: "manual" });
			if (res.status >= 200 && res.status < 500) return;
			lastError = new Error(`Got HTTP ${res.status}`);
		} catch (err) {
			lastError = err;
		}
		await new Promise((r) => setTimeout(r, 500));
	}

	throw new Error(
		`Timed out waiting for ${url} to become ready. Last error: ${String(lastError)}`,
	);
}

/**
 * Global setup for E2E tests
 *
 * 1. Starts a PostgreSQL container via Testcontainers
 * 2. Spawns the web server with DATABASE_URL passed directly in the environment
 *
 * This approach avoids the race condition where Playwright's webServer starts
 * before globalSetup completes, and eliminates the need for .env.test files.
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

	// Store container reference for teardown
	(globalThis as Record<string, unknown>).__E2E_CONTAINER__ = container;

	// Always spawn the web server with DATABASE_URL passed directly
	const port = process.env.E2E_PORT || "3000";
	console.log("[E2E Setup] Starting web server on port", port);

	// Test-specific OIDC clients for E2E tests
	const oidcClients = JSON.stringify([
		{
			clientId: "test-client",
			clientSecret: "test-secret",
			name: "Test Client",
			type: "web",
			redirectURLs: [`http://localhost:${port}/callback`],
			skipConsent: false,
		},
		{
			clientId: "trusted-client",
			clientSecret: "trusted-secret",
			name: "Trusted Client",
			type: "web",
			redirectURLs: [`http://localhost:${port}/callback`],
			skipConsent: true,
		},
	]);

	const server: ChildProcess = spawn(
		"pnpm",
		["dev", "--port", port, "--strictPort"],
		{
			cwd: process.cwd(),
			env: {
				...process.env,
				DATABASE_URL: connectionString,
				BETTER_AUTH_URL: `http://localhost:${port}`,
				BETTER_AUTH_SECRET:
					"test-secret-at-least-32-characters-long-for-testing",
				BETTER_AUTH_AUTO_MIGRATE: "true",
				ENABLE_REGISTRATION: "true",
				ENABLE_OIDC_PROVIDER: "true",
				ENABLE_PASSKEYS: "true",
				ENABLE_SIWE: "true",
				OIDC_REQUIRE_PKCE: "true",
				OIDC_CLIENTS: oidcClients,
				// Disable TanStack devtools to avoid port conflicts
				DISABLE_DEVTOOLS: "true",
			},
			stdio: ["ignore", "pipe", "pipe"],
		},
	);

	server.stdout?.on("data", (buf) =>
		process.stdout.write(`[WebServer] ${String(buf)}`),
	);
	server.stderr?.on("data", (buf) =>
		process.stderr.write(`[WebServer] ${String(buf)}`),
	);

	await waitForUrlReady(`http://localhost:${port}/api/health`, 120000);
	console.log("[E2E Setup] Web server is ready");

	(globalThis as Record<string, unknown>).__E2E_SERVER__ = server;
	console.log("[E2E Setup] Global setup complete");
}

export default globalSetup;
