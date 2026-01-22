import { type ChildProcess, spawn, spawnSync } from "node:child_process";
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
 * Wait for a URL to become ready (return 2xx status specifically)
 */
async function waitForUrlReady(url: string, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;
	let lastStatus: number | undefined;

	// Give the server a moment to start up
	await new Promise((r) => setTimeout(r, 3000));

	while (Date.now() < deadline) {
		try {
			const res = await fetch(url, { redirect: "manual" });
			lastStatus = res.status;
			// Only accept 2xx as ready - 503 means server is starting
			if (res.status >= 200 && res.status < 300) return;
			lastError = new Error(`Got HTTP ${res.status}`);
		} catch (err) {
			lastError = err;
		}
		// Wait longer between retries to let server initialize
		await new Promise((r) => setTimeout(r, 1000));
	}

	throw new Error(
		`Timed out waiting for ${url} to become ready. Last status: ${lastStatus}, Last error: ${String(lastError)}`,
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

	// Common environment variables for build and server
	// All required env vars are provided, so no need for SKIP_ENV_VALIDATION
	const serverEnv = {
		...process.env,
		DATABASE_URL: connectionString,
		BETTER_AUTH_URL: `http://localhost:${port}`,
		BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long-for-testing",
		BETTER_AUTH_AUTO_MIGRATE: "true",
		ENABLE_REGISTRATION: "true",
		ENABLE_OIDC_PROVIDER: "true",
		ENABLE_PASSKEYS: "true",
		ENABLE_SIWE: "true",
		OIDC_REQUIRE_PKCE: "true",
		OIDC_CLIENTS: oidcClients,
	};

	// Build the app first (production mode avoids Nitro/Vite dev server issues)
	// All required env vars are provided in serverEnv, so validation will pass
	console.log("[E2E Setup] Building application...");
	const buildResult = spawnSync("pnpm", ["build"], {
		cwd: process.cwd(),
		env: serverEnv,
		stdio: "inherit",
	});

	if (buildResult.status !== 0) {
		throw new Error(`Build failed with exit code ${buildResult.status}`);
	}
	console.log("[E2E Setup] Build complete");

	// Start the production server (more stable than dev mode)
	// --import flag loads reflect-metadata before the server (required by @simplewebauthn/server → tsyringe)
	const server: ChildProcess = spawn(
		"node",
		["--import=reflect-metadata", ".output/server/index.mjs"],
		{
			cwd: process.cwd(),
			env: {
				...serverEnv,
				PORT: port,
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
