import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.E2E_PORT || "3001";
const baseUrl = `http://localhost:${port}`;

/**
 * Playwright configuration for Dream Auth E2E tests
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined, // Single worker in CI for DB stability
	reporter: process.env.CI
		? [["html"], ["github"], ["list"]]
		: [["html"], ["list"]],

	// Global setup/teardown (starts DB container)
	globalSetup: path.resolve(__dirname, "./global-setup.ts"),
	globalTeardown: path.resolve(__dirname, "./global-teardown.ts"),

	use: {
		baseURL: baseUrl,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		// Sensible defaults
		actionTimeout: 10000,
		navigationTimeout: 30000,
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	// Expect config
	expect: {
		timeout: 10000,
	},

	// Output directory for test artifacts
	outputDir: "./test-results",

	// Web server config - starts dev server
	// Environment variables are set in process.env by global setup
	webServer: {
		command: `pnpm dev --port ${port}`,
		url: `${baseUrl}/api/health`,
		reuseExistingServer: !process.env.CI,
		timeout: 120000, // 2 minutes for server startup
		stdout: "pipe",
		stderr: "pipe",
	},
});
