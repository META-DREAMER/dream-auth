import { betterAuth } from "better-auth";
import { generateRandomString } from "better-auth/crypto";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { siwe } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { Pool } from "pg";
import { verifyMessage } from "viem";
import { serverEnv } from "@/env";
import { storeNonce, validateAndConsumeNonce } from "./nonce-store";

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

	// Enable account linking so users can link wallets to existing accounts
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["siwe", "email-password"],
			allowDifferentEmails: true,
		},
	},

	session: {
		// Note: Cookie caching has issues with TanStack Start's SSR context
		// Disable until better-auth fixes compatibility
		// cookieCache: {
		// 	enabled: true,
		// 	maxAge: 5 * 60, // 5 minutes
		// },
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
		// SIWE (Sign-In With Ethereum) authentication
		...(serverEnv.ENABLE_SIWE
			? [
					siwe({
						domain: authUrl.hostname,
						getNonce: async () => {
							// Generate a cryptographically secure random nonce
							const nonce = generateRandomString(32);
							// Store nonce with 5 minute expiration (using shared nonce store)
							storeNonce(nonce);
							return nonce;
						},
						verifyMessage: async ({ message, signature, address }) => {
							try {
								// Extract nonce from message for validation
								const nonceMatch = message.match(/Nonce: ([a-zA-Z0-9]+)/);
								const nonce = nonceMatch?.[1];

								if (!nonce) {
									return false;
								}

								// Validate and consume nonce (single use) using shared nonce store
								if (!validateAndConsumeNonce(nonce)) {
									return false;
								}

								// Verify the signature using viem (recommended)
								const isValid = await verifyMessage({
									address: address as `0x${string}`,
									message,
									signature: signature as `0x${string}`,
								});

								return isValid;
							} catch (error) {
								console.error("SIWE verification failed:", error);
								return false;
							}
						},
					}),
				]
			: []),
		// TanStack Start cookie handling - must be last plugin
		tanstackStartCookies(),
	],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
