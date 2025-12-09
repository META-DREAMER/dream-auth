import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Pool } from "pg";
import { serverEnv } from "@/env";

const pool = new Pool({
	connectionString: serverEnv.DATABASE_URL,
});

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
					domain: serverEnv.COOKIE_DOMAIN,
				},
			},
		},
	},

	// TanStack Start cookie handling - must be last plugin
	plugins: [tanstackStartCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
