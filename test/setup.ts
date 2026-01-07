import { afterAll, vi } from "vitest";

/**
 * Global test setup file
 * Sets up environment variables and mocks for all tests
 *
 * IMPORTANT: Environment variables are set synchronously at module load,
 * NOT in beforeAll(). This ensures env-dependent modules (like src/env.ts)
 * see the correct values when they're first imported.
 */

// Set test environment variables SYNCHRONOUSLY at module load
// This runs before any imports that depend on env vars
process.env.NODE_ENV = "test";
process.env.SKIP_ENV_VALIDATION = "true";

// Required env vars for tests
process.env.DATABASE_URL =
	process.env.TEST_DATABASE_URL ||
	"postgresql://test:test@localhost:5433/test_auth";
process.env.BETTER_AUTH_SECRET =
	"test-secret-at-least-32-characters-long-for-testing";
process.env.BETTER_AUTH_URL = "http://localhost:3000";

// Feature flags - disabled by default for unit tests
process.env.ENABLE_REGISTRATION = "true";
process.env.ENABLE_OIDC_PROVIDER = "false";
process.env.ENABLE_PASSKEYS = "false";
process.env.ENABLE_SIWE = "false";

// OIDC defaults
process.env.OIDC_REQUIRE_PKCE = "true";

// Optional: Suppress console output during tests
// Uncomment if tests are too noisy
// beforeAll(() => {
// 	vi.spyOn(console, "log").mockImplementation(() => {});
// 	vi.spyOn(console, "error").mockImplementation(() => {});
// 	vi.spyOn(console, "warn").mockImplementation(() => {});
// });

afterAll(() => {
	vi.restoreAllMocks();
});
