import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { emailOTP, jwt, oidcProvider, siwe } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Pool } from "pg";
import { http, verifyMessage, createPublicClient } from "viem";
import { generateSiweNonce } from "viem/siwe";
import { mainnet } from "viem/chains";
import { serverEnv, serverEnvWithOidc } from "@/env";
import { ensureOidcClientsSeeded } from "@/lib/oidc/sync-oidc-clients";

const pool = new Pool({
	connectionString: serverEnv.DATABASE_URL,
});

// Extract hostname from BETTER_AUTH_URL for WebAuthn rpID
const authUrl = new URL(serverEnv.BETTER_AUTH_URL);

/**
 * Get trusted OIDC clients from environment and file configuration.
 * Transforms config to BetterAuth's expected format.
 */
function getTrustedClients() {
	return serverEnvWithOidc.OIDC_CLIENTS.map((client) => ({
		clientId: client.clientId,
		clientSecret: client.clientSecret,
		name: client.name,
		redirectUrls: client.redirectURLs,
		skipConsent: client.skipConsent,
		disabled: client.disabled,
		metadata: client.metadata || null,
		icon: client.icon,
		type: client.type,
	}));
}


export const auth = betterAuth({
	database: pool,
	baseURL: serverEnv.BETTER_AUTH_URL,
	secret: serverEnv.BETTER_AUTH_SECRET,

	// Disable default /token endpoint when using JWT plugin for OIDC
	// OIDC uses /oauth2/token instead
	...(serverEnv.ENABLE_OIDC_PROVIDER && {
		disabledPaths: ["/token"],
	}),

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
	},

	// Enable changing email address with verification link
	user: {
		changeEmail: {
			enabled: true,
			updateEmailWithoutVerification: true,
		},
	},

	// Email verification config - used by changeEmail to send verification link
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			// TODO: Integrate with email service (Resend, SendGrid, etc.)
			console.log(`[Email Verification] Send to: ${user.email}`);
			console.log(`[Email Verification] URL: ${url}`);
		},
	},

	// Enable account linking so users can link wallets to existing accounts
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["siwe", "email-password", "email-otp"],
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

	// advanced: {
		// cookiePrefix: "auth",
		// cookies: {
			// session_token: {
				// attributes: {
					// httpOnly: true,
					// secure: process.env.NODE_ENV === "production",
					// sameSite: "lax",
					// Only set domain if explicitly configured (for cross-subdomain auth)
					// When undefined, cookie uses current origin (works for localhost)
					// ...(serverEnv.COOKIE_DOMAIN && { domain: serverEnv.COOKIE_DOMAIN }),
				// },
			// },
		// },
	// },

	plugins: [
		// JWT plugin for asymmetric token signing (required for OIDC provider)
		// Must come before oidcProvider plugin
		...(serverEnv.ENABLE_OIDC_PROVIDER ? [jwt()] : []),

		// OIDC Provider for SSO with Kubernetes apps (Grafana, ArgoCD, Immich, etc.)
		...(serverEnv.ENABLE_OIDC_PROVIDER
			? [
					oidcProvider({
						loginPage: "/login",
						consentPage: "/consent",
						// Enable JWT plugin integration for asymmetric signing
						useJWTPlugin: true,
						// Require PKCE for security (recommended)
						requirePKCE: serverEnv.OIDC_REQUIRE_PKCE,
						// Token expiration settings
						codeExpiresIn: 600, // 10 minutes
						accessTokenExpiresIn: 3600, // 1 hour
						refreshTokenExpiresIn: 604800, // 7 days
						// Supported scopes
						scopes: ["openid", "profile", "email", "offline_access"],
						// Store client secrets in plain text (matching our DB seeding format)
						// If you need hashed/encrypted storage, update sync-oidc-clients.ts accordingly
						storeClientSecret: "plain",
						// Trusted clients from environment configuration
						// These are also seeded to DB via sync-oidc-clients.ts for FK integrity
						// trustedClients provides skipConsent UX; DB seeding provides FK integrity
						trustedClients: getTrustedClients(),
					}),
				]
			: []),

		// Passkey/WebAuthn authentication
		...(serverEnv.ENABLE_PASSKEYS
			? [
					passkey({
						rpName: "Dream Auth",
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
							// Better-auth handles nonce storage and validation internally
							return generateSiweNonce();
						},
						verifyMessage: async ({ message, signature, address }) => {
							try {
								// Verify the signature using viem
								// Better-auth validates the nonce internally
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
						ensLookup: async ({ walletAddress }) => {
							try {
								// Optional: lookup ENS name and avatar using viem
								// You can use viem's ENS utilities here
								const client = createPublicClient({
									chain: mainnet,
									transport: http(),
								});
								const ensName = await client.getEnsName({
									address: walletAddress as `0x${string}`,
								});
								const ensAvatar = ensName
									? await client.getEnsAvatar({
											name: ensName,
										})
									: null;
								return {
									name: ensName || walletAddress,
									avatar: ensAvatar || "",
								};
							} catch {
								return {
									name: walletAddress,
									avatar: "",
								};
							}
						},
					}),
				]
			: []),
		// Email OTP for linking emails to accounts
		emailOTP({
			overrideDefaultEmailVerification: true,
			async sendVerificationOTP({ email, otp, type }) {
				// TODO: Integrate with email service (Resend, SendGrid, etc.)
				console.log(
					`[Email OTP] Send to: ${email}, OTP: ${otp}, Type: ${type}`,
				);
			},
		}),
		// TanStack Start cookie handling - must be last plugin
		tanstackStartCookies(),
	],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;

/**
 * Ensure OIDC clients are seeded to DB on server startup.
 * This runs non-blocking in the background to avoid delaying server startup.
 * The existing ensureOidcReady() in the auth route handler ensures seeding is completed before handling auth requests.
 *
 * @see https://github.com/better-auth/better-auth/issues/6649
 */
if (serverEnv.ENABLE_OIDC_PROVIDER) {
	// Fire-and-forget: don't await, don't block server startup
	ensureOidcClientsSeeded(serverEnvWithOidc.OIDC_CLIENTS).catch(
		(error) => {
			console.error(
				"[OIDC] Failed to seed clients on server startup (non-blocking):",
				error,
			);
			// Don't throw - this is a background operation
		},
	);
}

