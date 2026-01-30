import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for integration tests.
 * These tests use testcontainers to spin up a real PostgreSQL database.
 *
 * Run with: pnpm test:integration
 */
export default defineConfig({
	plugins: [
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
	],
	test: {
		// Global setup runs BEFORE test files are loaded (starts DB container)
		globalSetup: ["./test/global-setup.ts"],

		// Setup files run after globalSetup but before tests (reads DB connection)
		setupFiles: ["./test/setup.ts", "./test/setup-db.ts"],

		// Only include integration tests
		include: [
			"src/**/*.int.test.ts",
			"server/**/*.int.test.ts",
			"tests/**/*.int.test.ts",
		],

		// Exclude patterns
		exclude: ["node_modules", "dist", ".output"],

		// Integration tests use node environment
		environment: "node",

		// Pool options - use single fork for integration tests to share DB container
		pool: "forks",
		poolOptions: {
			forks: {
				singleFork: true, // Share DB container across tests
			},
		},

		// Longer timeout for container startup and DB operations
		testTimeout: 60000,
		hookTimeout: 120000, // Container startup can take up to 2 minutes

		// Run tests sequentially to avoid DB conflicts
		sequence: {
			concurrent: false,
		},
	},
});
