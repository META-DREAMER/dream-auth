import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

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

		// Cookie configuration
		COOKIE_DOMAIN: z.string().min(1),

		// Feature flags
		ENABLE_REGISTRATION: z
			.string()
			.default("false")
			.transform((val) => val === "true"),

		// Admin configuration
		ADMIN_EMAILS: z
			.string()
			.transform((val) => val.split(",").map((email) => email.trim()))
			.optional(),
	},

	/**
	 * Server-side vars use process.env
	 */
	runtimeEnv: process.env,

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
