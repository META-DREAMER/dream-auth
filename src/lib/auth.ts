import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { passkey } from "@better-auth/passkey";
import { Pool } from "pg";
import { serverEnv } from "@/env";

const pool = new Pool({
	connectionString: serverEnv.DATABASE_URL,
});

// Extract hostname from BETTER_AUTH_URL for WebAuthn rpID
const authUrl = new URL(serverEnv.BETTER_AUTH_URL);

export const auth = betterAuth({
	database: pool,
	baseURL: serverEnv.BETTER_AUTH_URL,
	secret: serverEnv.BETTER_AUTH_SECRET,

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
	},

	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 minutes
		},
	},

	advanced: {
		cookiePrefix: "auth",
		cookies: {
			session_token: {
				attributes: {
					httpOnly: true,
					secure: process.env.NODE_ENV === "production",
					sameSite: "lax",
					// Only set domain if explicitly configured (for cross-subdomain auth)
					// When undefined, cookie uses current origin (works for localhost)
					...(serverEnv.COOKIE_DOMAIN && { domain: serverEnv.COOKIE_DOMAIN }),
				},
			},
		},
	},

	plugins: [
		// Passkey/WebAuthn authentication
		...(serverEnv.ENABLE_PASSKEYS
			? [
					passkey({
						rpName: "Auth Server",
						rpID: authUrl.hostname,
						origin: serverEnv.BETTER_AUTH_URL,
					}),
				]
			: []),
		// TanStack Start cookie handling - must be last plugin
		tanstackStartCookies(),
	],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
