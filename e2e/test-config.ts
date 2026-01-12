/**
 * E2E Test Configuration
 *
 * Single source of truth for E2E test environment variables.
 * Can be overridden via environment variables (e.g., in GitHub Actions).
 */

export interface E2ETestConfig {
	port: string;
	baseUrl: string;
	databaseUrl?: string; // Set dynamically by global-setup after container starts
	nodeEnv: string;
	skipEnvValidation: string;
	betterAuthSecret: string;
	betterAuthUrl: string;
	betterAuthAutoMigrate: string;
	enableRegistration: string;
	enableOidcProvider: string;
	enablePasskeys: string;
	enableSiwe: string;
	oidcRequirePkce: string;
	oidcClients: string;
}

/**
 * Get E2E test configuration with sensible defaults.
 * Environment variables take precedence over defaults.
 */
export function getE2ETestConfig(): E2ETestConfig {
	const port = process.env.E2E_PORT || "3001";
	const baseUrl = process.env.E2E_BASE_URL || `http://localhost:${port}`;

	return {
		port,
		baseUrl,
		databaseUrl: process.env.DATABASE_URL, // Set by global-setup
		nodeEnv: process.env.NODE_ENV || "test",
		skipEnvValidation: process.env.SKIP_ENV_VALIDATION || "true",
		betterAuthSecret:
			process.env.BETTER_AUTH_SECRET ||
			"test-secret-at-least-32-characters-long-for-testing",
		betterAuthUrl: process.env.BETTER_AUTH_URL || baseUrl,
		betterAuthAutoMigrate: process.env.BETTER_AUTH_AUTO_MIGRATE || "true",
		enableRegistration: process.env.ENABLE_REGISTRATION || "true",
		enableOidcProvider: process.env.ENABLE_OIDC_PROVIDER || "true",
		enablePasskeys: process.env.ENABLE_PASSKEYS || "true",
		enableSiwe: process.env.ENABLE_SIWE || "true",
		oidcRequirePkce: process.env.OIDC_REQUIRE_PKCE || "true",
		oidcClients:
			process.env.OIDC_CLIENTS ||
			JSON.stringify([
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
			]),
	};
}

/**
 * Convert test config to environment variable object for process.env
 */
export function configToEnvVars(config: E2ETestConfig): Record<string, string> {
	const envVars: Record<string, string> = {
		PORT: config.port,
		NODE_ENV: config.nodeEnv,
		SKIP_ENV_VALIDATION: config.skipEnvValidation,
		BETTER_AUTH_SECRET: config.betterAuthSecret,
		BETTER_AUTH_URL: config.betterAuthUrl,
		BETTER_AUTH_AUTO_MIGRATE: config.betterAuthAutoMigrate,
		ENABLE_REGISTRATION: config.enableRegistration,
		ENABLE_OIDC_PROVIDER: config.enableOidcProvider,
		ENABLE_PASSKEYS: config.enablePasskeys,
		ENABLE_SIWE: config.enableSiwe,
		OIDC_REQUIRE_PKCE: config.oidcRequirePkce,
		OIDC_CLIENTS: config.oidcClients,
	};

	// Only add DATABASE_URL if it's set (dynamic from container)
	if (config.databaseUrl) {
		envVars.DATABASE_URL = config.databaseUrl;
	}

	return envVars;
}

/**
 * Convert config to .env file format
 */
export function configToEnvFile(config: E2ETestConfig): string {
	const envVars = configToEnvVars(config);
	return Object.entries(envVars)
		.map(([key, value]) => `${key}=${value}`)
		.join("\n");
}
