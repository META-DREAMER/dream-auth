import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
	],
	test: {
		// Global setup for all tests
		setupFiles: ["./test/setup.ts"],

		// Include patterns
		include: [
			"src/**/*.test.ts",
			"src/**/*.test.tsx",
			"src/**/*.int.test.ts",
			"server/**/*.test.ts",
			"server/**/*.int.test.ts",
			"tests/**/*.test.ts",
		],

		// Exclude patterns
		exclude: ["node_modules", "dist", ".output"],

		// Environment matching - jsdom for React, node for server code
		environmentMatchGlobs: [
			// Hook and component tests use jsdom
			["**/*.test.tsx", "jsdom"],
			// Server/integration tests use node
			["**/*.int.test.ts", "node"],
			// Default to node for unit tests
			["**/*.test.ts", "node"],
		],

		// Coverage configuration
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html", "lcov"],
			reportsDirectory: "./coverage",

			// Include source files for coverage
			include: [
				"src/lib/**/*.ts",
				"src/routes/api/**/*.ts",
				"src/routes/oauth2/**/*.ts",
				"src/routes/[.]well-known/**/*.ts",
				"src/hooks/**/*.ts",
				"server/plugins/**/*.ts",
			],

			// Exclude from coverage
			exclude: [
				"**/*.test.ts",
				"**/*.test.tsx",
				"**/*.int.test.ts",
				"**/index.ts",
				"src/lib/auth-client.ts", // Client-side BetterAuth wrapper
				"src/lib/auth.ts", // BetterAuth server config (requires full integration)
				"src/lib/wagmi.ts", // External wagmi config
				"src/lib/org-queries.ts", // TanStack Query definitions (thin wrappers)
				"src/lib/session.server.ts", // Server session helpers (requires SSR context)
				"src/lib/toast-variants.ts", // UI toast config (visual, not behavioral)
				"src/lib/oidc/sync-oidc-clients.ts", // Covered by int tests (skipped without DB)
				"src/hooks/use-media-query.ts", // Browser API wrapper
				"src/hooks/use-mobile.ts", // Simple derived hook
				"src/routes/api/auth/**", // BetterAuth catch-all (thin proxy)
				"server/plugins/**", // Nitro plugins (require server runtime)
				"src/routeTree.gen.ts", // Generated file
				"src/components/ui/**", // shadcn/ui components
			],

			// 60% threshold as required
			thresholds: {
				lines: 60,
				functions: 60,
				branches: 60,
				statements: 60,
			},
		},

		// Pool options for test execution
		pool: "forks",
		poolOptions: {
			forks: {
				singleFork: false,
			},
		},

		// Timeout for integration tests
		testTimeout: 30000,
		hookTimeout: 30000,
	},
});
