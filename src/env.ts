import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import type { OidcClientConfig } from "@/lib/oidc/schemas";
import {
	parseOidcClientsJson,
	loadOidcClientsFromFile,
	mergeOidcClients,
} from "@/lib/oidc/config";


/**
 * Server-side environment variables.
 * Only import this in server-side code (API routes, server functions, etc.)
 */
export const serverEnv = createEnv({
	server: {
		// Database
		DATABASE_URL: z.string().url(),

		// BetterAuth configuration
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.string().url(),
		// Run Better Auth database migrations automatically on server startup.
		// Safe for Kubernetes/GitOps deployments:
		// - Uses PostgreSQL advisory lock to prevent concurrent migrations
		// - Skips if no migrations needed (no lock contention when up-to-date)
		// - Better Auth migrations are always additive (never drops columns/tables)
		// - Detailed logging for GitOps audit trails
		BETTER_AUTH_AUTO_MIGRATE: z
			.string()
			.default("false")
			.transform((val) => val === "true"),
		// PostgreSQL advisory lock key used to ensure only one pod migrates at a time.
		// Change this if running multiple independent deployments on the same database.
		BETTER_AUTH_MIGRATION_LOCK_KEY: z
			.string()
			.default("dream-auth:better-auth:migrations"),
		// How long to wait for the migration lock before failing startup (in ms).
		// Default: 10 minutes, which handles slow migrations or pod startup delays.
		BETTER_AUTH_MIGRATION_LOCK_TIMEOUT_MS: z
			.string()
			.default("600000")
			.transform((val) => Number(val))
			.pipe(z.number().int().positive()),

		// Cookie configuration - optional for local development
		// When not set, cookies will use the current origin (works on localhost)
		COOKIE_DOMAIN: z.string().min(1).optional(),

		// Feature flags
		ENABLE_REGISTRATION: z
			.string()
			.default("false")
			.transform((val) => val === "true"),
		ENABLE_PASSKEYS: z
			.string()
			.default("true")
			.transform((val) => val === "true"),
		ENABLE_SIWE: z
			.string()
			.default("true")
			.transform((val) => val === "true"),
		ENABLE_OIDC_PROVIDER: z
			.string()
			.default("false")
			.transform((val) => val === "true"),

		// OIDC Provider configuration
		// JSON array of trusted OIDC clients (from environment variable)
		// Example: '[{"clientId":"grafana","clientSecret":"secret","name":"Grafana","type":"web","redirectURLs":["https://grafana.example.com/login/generic_oauth"],"skipConsent":true}]'
		OIDC_CLIENTS_ENV: z
			.string()
			.optional()
			.transform((val) => {
				if (!val) return [];
				return parseOidcClientsJson(val, "OIDC_CLIENTS");
			}),

		// Path to a JSON file containing OIDC client configurations
		// Use this for GitOps deployments where clients are mounted as a ConfigMap
		// Example: '/config/oidc-clients.json'
		OIDC_CLIENTS_FILE: z.string().optional(),

		// OIDC PKCE requirement (recommended for security)
		OIDC_REQUIRE_PKCE: z
			.string()
			.default("true")
			.transform((val) => val === "true"),

		// Admin configuration
		ADMIN_EMAILS: z
			.string()
			.transform((val) => val.split(",").map((email) => email.trim()))
			.optional(),
	},

	/**
	 * Server-side vars use process.env
	 * Note: OIDC_CLIENTS env var is mapped to OIDC_CLIENTS_ENV internally
	 */
	runtimeEnv: {
		...process.env,
		OIDC_CLIENTS_ENV: process.env.OIDC_CLIENTS,
	},

	/**
	 * By default, this library will feed the environment variables directly to
	 * the Zod validator.
	 *
	 * This means that if you have an empty string for a value that is supposed
	 * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
	 * it as a type mismatch violation. Additionally, if you have an empty string
	 * for a value that is supposed to be a string with a default value (e.g.
	 * `DOMAIN=` in an ".env" file), the default value will never be applied.
	 *
	 * In order to solve these issues, we recommend that all new projects
	 * explicitly specify this option as true.
	 */
	emptyStringAsUndefined: true,

	/**
	 * Skip validation during build time to avoid missing env var errors
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});

/**
 * Cached merged OIDC clients (computed once at startup)
 */
let cachedOidcClients: OidcClientConfig[] | null = null;

/**
 * Get all OIDC clients from both environment variable and mounted file.
 * Results are cached after first access.
 */
function getOidcClients(): OidcClientConfig[] {
	if (cachedOidcClients !== null) {
		return cachedOidcClients;
	}

	const envClients = serverEnv.OIDC_CLIENTS_ENV || [];
	const fileClients = serverEnv.OIDC_CLIENTS_FILE
		? loadOidcClientsFromFile(serverEnv.OIDC_CLIENTS_FILE)
		: [];

	cachedOidcClients = mergeOidcClients(envClients, fileClients);

	if (cachedOidcClients.length > 0) {
		console.log(
			`[OIDC] Loaded ${cachedOidcClients.length} client(s): ${cachedOidcClients.map((c) => c.clientId).join(", ")}`,
		);
	}

	return cachedOidcClients;
}

/**
 * Extended server environment with computed OIDC_CLIENTS property.
 * Use this instead of serverEnv directly when accessing OIDC_CLIENTS.
 */
export const serverEnvWithOidc = {
	...serverEnv,
	/**
	 * Merged OIDC clients from OIDC_CLIENTS env var and OIDC_CLIENTS_FILE.
	 * Validated with Zod, duplicates checked, fail-fast in production.
	 */
	get OIDC_CLIENTS(): OidcClientConfig[] {
		return getOidcClients();
	},
};
