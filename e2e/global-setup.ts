import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import dotenv from "dotenv";

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
 * Loads `.env.test` for required server-side configuration (Better Auth, etc.).
 *
 * In CI, we spawn the web server manually AFTER the database container is ready.
 * This avoids the race condition where Playwright's webServer starts before
 * globalSetup completes and DATABASE_URL is available.
 *
 * Locally, we let Playwright's webServer handle server lifecycle since developers
 * can use reuseExistingServer for faster iteration.
 */
async function globalSetup(_config: FullConfig) {
	// Ensure required server-side env vars (BETTER_AUTH_SECRET/URL, etc.) are loaded.
	// Vite exposes env vars to `import.meta.env`, but our server code validates via `process.env`.
	const envTestPath = path.resolve(process.cwd(), ".env.test");
	if (existsSync(envTestPath)) {
		dotenv.config({ path: envTestPath });
	}
	const envTestLocalPath = path.resolve(process.cwd(), ".env.test.local");
	if (existsSync(envTestLocalPath)) {
		dotenv.config({ path: envTestLocalPath, override: true });
	}

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

	if (process.env.CI) {
		// In CI, start the web server manually AFTER DATABASE_URL is known
		// This avoids the race condition where Playwright's webServer starts before globalSetup
		console.log("[E2E Setup] Starting web server...");

		const port = process.env.E2E_PORT || "3001";
		const server: ChildProcess = spawn(
			"pnpm",
			["dev", "--mode", "test", "--port", port],
			{
				cwd: process.cwd(),
				env: {
					...process.env,
					DATABASE_URL: connectionString,
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
	} else {
		// Locally, Playwright's webServer needs DATABASE_URL in the environment
		// Set it here so it's available when the webServer spawns
		process.env.DATABASE_URL = connectionString;
	}

	console.log("[E2E Setup] Global setup complete");
}

export default globalSetup;
