import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import {
	emailOTP,
	jwt,
	oidcProvider,
	organization,
	siwe,
} from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Pool } from "pg";
import { createPublicClient, http, verifyMessage } from "viem";
import { mainnet } from "viem/chains";
import { generateSiweNonce } from "viem/siwe";
import { serverEnv, serverEnvWithOidc } from "@/env";

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
		// Disable public email/password signup when ENABLE_REGISTRATION is false
		// Users can still sign up via organization invitations
		disableSignUp: !serverEnv.ENABLE_REGISTRATION,
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

	// Block non-invitation signups when ENABLE_REGISTRATION is false
	// This catches SIWE and other providers not covered by disableSignUp
	databaseHooks: {
		user: {
			create: {
				before: async (user) => {
					// Allow if public registration is enabled
					if (serverEnv.ENABLE_REGISTRATION) return;

					// Check if user email matches a pending invitation
					// This allows signup via invitation acceptance
					const pendingInvitation = await pool.query(
						`SELECT id FROM invitation WHERE email = $1 AND status = 'pending' AND "expiresAt" > NOW() LIMIT 1`,
						[user.email.toLowerCase()],
					);

					if (pendingInvitation.rows.length > 0) {
						// Allow signup - user has a pending invitation
						return;
					}

					// Block signup - no valid invitation found
					throw new APIError("FORBIDDEN", {
						message:
							"Registration is disabled. Please contact an administrator for an invitation.",
					});
				},
			},
		},
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
						// Supported scopes - includes 'groups' for org membership claims
						scopes: ["openid", "profile", "email", "groups", "offline_access"],
						// Store client secrets in plain text (matching our DB seeding format)
						// If you need hashed/encrypted storage, update sync-oidc-clients.ts accordingly
						storeClientSecret: "plain",
						// Trusted clients from environment configuration
						// These are also seeded to DB via sync-oidc-clients.ts for FK integrity
						// trustedClients provides skipConsent UX; DB seeding provides FK integrity
						trustedClients: getTrustedClients(),
						// Add custom claims to UserInfo endpoint and ID token
						getAdditionalUserInfoClaim: async (user, scopes) => {
							const claims: Record<string, unknown> = {};

							// Add groups claim when 'groups' scope is requested
							// Returns organization slugs for RBAC in downstream apps (ArgoCD, Grafana, etc.)
							if (scopes.includes("groups")) {
								const memberships = await pool.query(
									`SELECT o.slug FROM member m 
									 JOIN organization o ON m."organizationId" = o.id 
									 WHERE m."userId" = $1`,
									[user.id],
								);
								claims.groups = memberships.rows.map(
									(row: { slug: string }) => row.slug,
								);
							}

							return claims;
						},
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
		// Organization plugin for invitation-based access control
		organization({
			teams: {
				enabled: true,
			},
			// Extend invitation schema with wallet address for SIWE-based invitations
			schema: {
				invitation: {
					additionalFields: {
						// Optional wallet address for wallet-based invitations
						// When set, user must sign in with SIWE using this wallet to accept
						walletAddress: {
							type: "string",
							required: false,
							input: true,
						},
					},
				},
			},

			// Lifecycle hooks for invitation management
			organizationHooks: {
				// Verify wallet ownership before accepting wallet-based invitations
				beforeAcceptInvitation: async ({ invitation, user }) => {
					// Skip verification for email-only invitations
					const walletAddress = (
						invitation as typeof invitation & { walletAddress?: string }
					).walletAddress;
					if (!walletAddress) return;

					// Verify user has SIWE account linked with the invited wallet
					const accounts = await pool.query(
						`SELECT "accountId" FROM account WHERE "userId" = $1 AND "providerId" = 'siwe'`,
						[user.id],
					);

					// SIWE accountId format is "walletAddress:chainId"
					const hasMatchingWallet = accounts.rows.some(
						(row: { accountId: string }) =>
							row.accountId
								.toLowerCase()
								.startsWith(walletAddress.toLowerCase()),
					);

					if (!hasMatchingWallet) {
						throw new APIError("FORBIDDEN", {
							message:
								"You must sign in with the invited wallet address to accept this invitation.",
						});
					}
				},
			},

			// Send invitation notifications
			async sendInvitationEmail(data) {
				const inviteLink = `${serverEnv.BETTER_AUTH_URL}/invite/${data.id}`;
				const walletAddress = (data as typeof data & { walletAddress?: string })
					.walletAddress;

				if (walletAddress) {
					// Wallet invitation - log for now, could integrate with push notification service
					console.log(`[Wallet Invitation] Wallet: ${walletAddress}`);
					console.log(
						`[Wallet Invitation] Organization: ${data.organization.name}`,
					);
					console.log(`[Wallet Invitation] Role: ${data.role}`);
					console.log(`[Wallet Invitation] Link: ${inviteLink}`);
				} else {
					// Email invitation - integrate with email service
					// TODO: Integrate with Resend, SendGrid, etc.
					console.log(`[Email Invitation] To: ${data.email}`);
					console.log(
						`[Email Invitation] Organization: ${data.organization.name}`,
					);
					console.log(`[Email Invitation] Role: ${data.role}`);
					console.log(
						`[Email Invitation] Invited by: ${data.inviter.user.email}`,
					);
					console.log(`[Email Invitation] Link: ${inviteLink}`);
				}
			},

			// Invitation expires in 7 days
			invitationExpiresIn: 60 * 60 * 24 * 7,
		}),
		// TanStack Start cookie handling - must be last plugin
		tanstackStartCookies(),
	],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
