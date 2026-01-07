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

		// Exclude integration tests from main run (they have their own config)
		exclude: ["node_modules", "dist", ".output", "**/*.int.test.ts"],

		// Use workspace projects for environment-specific configs
		workspace: [
			{
				// React/component tests with jsdom
				extends: true,
				test: {
					name: "jsdom",
					environment: "jsdom",
					include: ["src/**/*.test.tsx"],
				},
			},
			{
				// Server/unit tests with node
				extends: true,
				test: {
					name: "node",
					environment: "node",
					include: [
						"src/**/*.test.ts",
						"server/**/*.test.ts",
						"tests/**/*.test.ts",
					],
				},
			},
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
				"src/lib/oidc/sync-oidc-clients.ts", // Covered by int tests
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

		// Timeout for tests
		testTimeout: 30000,
		hookTimeout: 30000,
	},
});
