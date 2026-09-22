import { oauthProvider } from "@better-auth/oauth-provider";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { emailOTP, jwt, organization, siwe } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { createPublicClient, http, verifyMessage } from "viem";
import { mainnet } from "viem/chains";
import { generateSiweNonce } from "viem/siwe";
import { serverEnv, serverEnvWithOidc } from "@/env";
import { pool } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import {
	type OtpType,
	orgInvitationEmail,
	otpEmail,
	verificationEmail,
	walletInvitationEmail,
} from "@/lib/email/templates";
import { hashClientSecret } from "@/lib/oidc/hash-client-secret";
import {
	collectWalletAddresses,
	isSignupAllowed,
	REGISTRATION_DISABLED_ERROR,
} from "@/lib/registration-gate";

// Extract hostname from BETTER_AUTH_URL for WebAuthn rpID
const authUrl = new URL(serverEnv.BETTER_AUTH_URL);

/**
 * Client IDs that @better-auth/oauth-provider may cache in memory.
 *
 * The 1.7 plugin has no `trustedClients` option: every client lives in the
 * `oauthClient` table, seeded from config by `src/lib/oidc/sync-oidc-clients.ts`.
 * `cachedTrustedClients` only says which of those rows may be cached (and are
 * therefore immutable through the CRUD endpoints), which is exactly right for
 * config-owned clients.
 */
function getCachedTrustedClientIds(): Set<string> {
	return new Set(
		serverEnvWithOidc.OIDC_CLIENTS.map((client) => client.clientId),
	);
}

/**
 * Organization slugs for the `groups` claim, for RBAC in downstream apps
 * (ArgoCD, Grafana, ...). Only returned when the `groups` scope was granted.
 */
async function getGroupsClaim(
	userId: string,
	scopes: readonly string[],
): Promise<Record<string, unknown>> {
	if (!scopes.includes("groups")) return {};

	const memberships = await pool.query(
		`SELECT o.slug FROM member m
		 JOIN organization o ON m."organizationId" = o.id
		 WHERE m."userId" = $1`,
		[userId],
	);

	return { groups: memberships.rows.map((row: { slug: string }) => row.slug) };
}

/**
 * Turn a failed send into an APIError.
 *
 * Known caveat on better-auth 1.7.5: the three email callbacks are invoked
 * through `ctx.context.runInBackgroundOrAwait()`, which awaits the promise
 * inside a try/catch and only logs whatever it caught
 * (`dist/context/create-context.mjs`). A throw from here therefore does *not*
 * reach the HTTP client. Throwing is still correct — it is the documented
 * contract, it produces the log line, and it becomes visible again if
 * better-auth stops swallowing — but for invitations we also bridge the
 * failure into `afterCreateInvitation`, which is awaited normally and does
 * propagate. See `recordInvitationSendFailure` below.
 */
function emailFailure(result: {
	code: string;
	message: string;
	retryable: boolean;
}) {
	return new APIError("INTERNAL_SERVER_ERROR", {
		message: result.retryable
			? "Could not send the email right now. Please try again."
			: "That email address could not be reached.",
		code: result.code,
	});
}

/**
 * Invitation rows are inserted *before* `sendInvitationEmail` runs and are not
 * rolled back when it fails, so a failed send leaves a `pending` row nobody
 * was told about. The row self-heals (7-day expiry) and can be re-sent from
 * the members page, but the admin has to know it happened — and the callback's
 * own throw is swallowed (see `emailFailure`).
 *
 * So the failure is parked here and rethrown from `afterCreateInvitation`,
 * which better-auth awaits directly. Bounded so a failure on the resend path
 * (which never reaches `afterCreateInvitation`) cannot grow without limit.
 */
const MAX_PARKED_SEND_FAILURES = 50;
const parkedInvitationSendFailures = new Map<string, APIError>();

function recordInvitationSendFailure(invitationId: string, error: APIError) {
	if (parkedInvitationSendFailures.size >= MAX_PARKED_SEND_FAILURES) {
		const oldest = parkedInvitationSendFailures.keys().next().value;
		if (oldest) parkedInvitationSendFailures.delete(oldest);
	}
	parkedInvitationSendFailures.set(invitationId, error);
}

function takeInvitationSendFailure(invitationId: string): APIError | undefined {
	const error = parkedInvitationSendFailures.get(invitationId);
	if (error) parkedInvitationSendFailures.delete(invitationId);
	return error;
}

export const auth = betterAuth({
	database: pool,
	baseURL: serverEnv.BETTER_AUTH_URL,
	secret: serverEnv.BETTER_AUTH_SECRET,

	/**
	 * Since 1.7 the origin header is enforced on /sign-in/email,
	 * /sign-up/email and /email-otp/send-verification-otp even for cookieless
	 * requests. baseURL's own origin is trusted implicitly; COOKIE_DOMAIN is
	 * added explicitly because a cross-subdomain deployment sets it precisely
	 * so that sibling hosts can drive these endpoints.
	 */
	trustedOrigins: [
		new URL(serverEnv.BETTER_AUTH_URL).origin,
		...(serverEnv.COOKIE_DOMAIN
			? [
					`https://*.${serverEnv.COOKIE_DOMAIN.replace(/^\./, "")}`,
					`https://${serverEnv.COOKIE_DOMAIN.replace(/^\./, "")}`,
				]
			: []),
	],

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

	user: {
		/**
		 * Registration gate for ENABLE_REGISTRATION=false.
		 *
		 * `validateUserInfo` (1.7.0) runs on every provisioning path, including
		 * SIWE - unlike the `databaseHooks.user.create.before` hook it replaces,
		 * which only saw the placeholder email SIWE mints and so made wallet
		 * invitations unreachable for users without an existing account.
		 *
		 * Only `create-user` is gated. `link-account` must stay open so an
		 * existing user can still link a wallet or a passkey.
		 */
		validateUserInfo: async ({ user, source }, ctx) => {
			if (serverEnv.ENABLE_REGISTRATION) return;
			if (source.action !== "create-user") return;

			const email = typeof user.email === "string" ? user.email : undefined;
			const allowed = await isSignupAllowed({
				enableRegistration: false,
				email,
				walletAddresses: collectWalletAddresses({
					email,
					requestBody: ctx?.body,
				}),
			});

			if (!allowed) return REGISTRATION_DISABLED_ERROR;
		},

		// Enable changing email address with verification link
		changeEmail: {
			enabled: true,
			updateEmailWithoutVerification: true,
		},
	},

	// Email verification config - used by changeEmail to send verification link
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			const template = verificationEmail({ url });
			const result = await sendEmail({ to: user.email, ...template });
			if (!result.ok) throw emailFailure(result);
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
		// Must come before the oauthProvider plugin
		...(serverEnv.ENABLE_OIDC_PROVIDER ? [jwt()] : []),

		// OAuth/OIDC Provider for SSO with Kubernetes apps (Grafana, ArgoCD, Immich, etc.)
		// Replaces the `oidcProvider` plugin, removed from better-auth in 1.7.0.
		...(serverEnv.ENABLE_OIDC_PROVIDER
			? [
					oauthProvider({
						loginPage: "/login",
						consentPage: "/consent",
						// Token expiration settings
						codeExpiresIn: 600, // 10 minutes
						accessTokenExpiresIn: 3600, // 1 hour
						refreshTokenExpiresIn: 604800, // 7 days
						// Supported scopes - includes 'groups' for org membership claims
						scopes: ["openid", "profile", "email", "groups", "offline_access"],
						// Secrets are never stored in plain text since 1.7. The seeder in
						// sync-oidc-clients.ts hashes with the same function, so a seeded
						// row verifies against the secret the downstream app sends.
						storeClientSecret: { hash: hashClientSecret },
						// Config-owned clients: rows come from sync-oidc-clients.ts; this
						// only marks them cacheable and immutable through the CRUD API.
						// PKCE and consent-skipping are per-client columns now, written by
						// the seeder from OIDC_REQUIRE_PKCE and `skipConsent`.
						cachedTrustedClients: getCachedTrustedClientIds(),
						// ID tokens no longer carry profile/email claims; consumers read
						// those from /oauth2/userinfo. `groups` is surfaced in both so
						// downstream RBAC keeps working wherever it reads it from.
						customIdTokenClaims: async ({ user, scopes }) =>
							getGroupsClaim(user.id, scopes),
						customUserInfoClaims: async ({ user, scopes }) =>
							getGroupsClaim(user.id, scopes),
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
			async sendVerificationOTP({ email, otp, type }, _ctx) {
				const template = otpEmail({ otp, type: type as OtpType });
				const result = await sendEmail({ to: email, ...template });
				if (!result.ok) throw emailFailure(result);
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
				/**
				 * Surface a failed invitation email to the admin who triggered it.
				 * better-auth swallows whatever `sendInvitationEmail` throws; this
				 * hook is awaited normally, so rethrowing here reaches the client.
				 * The `pending` row stays behind either way — it expires in 7 days
				 * and the members page can re-send it.
				 */
				afterCreateInvitation: async ({ invitation }) => {
					const failure = takeInvitationSendFailure(invitation.id);
					if (failure) throw failure;
				},

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
			async sendInvitationEmail(data, _ctx) {
				const inviteLink = `${serverEnv.BETTER_AUTH_URL}/invite/${data.id}`;
				const walletAddress = (data as typeof data & { walletAddress?: string })
					.walletAddress;

				// A wallet invitation still travels by email: the wallet is a
				// constraint on who may accept, not a delivery channel. If one ever
				// arrives with no address there is nowhere to send it.
				if (!data.email) {
					console.error(
						JSON.stringify({
							event: "email.send",
							ok: false,
							code: "NO_RECIPIENT",
							message: "Invitation has no email address; nothing sent.",
						}),
					);
					return;
				}

				const fields = {
					orgName: data.organization.name,
					inviterEmail: data.inviter.user.email,
					role: data.role,
					inviteLink,
				};

				const template = walletAddress
					? walletInvitationEmail({ ...fields, walletAddress })
					: orgInvitationEmail(fields);

				const result = await sendEmail({ to: data.email, ...template });
				if (!result.ok) {
					const error = emailFailure(result);
					recordInvitationSendFailure(data.id, error);
					throw error;
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
