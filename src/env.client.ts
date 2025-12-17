import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Client-side environment variables.
 * These are safe to use in browser code.
 */
export const clientEnv = createEnv({
	clientPrefix: "VITE_",

	client: {
		VITE_APP_TITLE: z.string().min(1).optional().default("Dream Auth"),
		// Auth URL for the client - used by better-auth client
		// Optional: if not set, better-auth uses relative paths (same-origin)
		VITE_AUTH_URL: z.string().url().optional(),
		// WalletConnect project ID for mobile wallet support (optional)
		VITE_WALLETCONNECT_PROJECT_ID: z.string().min(1).optional(),
	},

	runtimeEnv: import.meta.env,
	emptyStringAsUndefined: true,
	skipValidation: !!import.meta.env.SKIP_ENV_VALIDATION,
});
