import { oauthProvider } from "@better-auth/oauth-provider";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { emailOTP, jwt, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { serverEnv, serverEnvWithOidc } from "@/env";
import { buildCookieAdvancedOptions } from "@/lib/auth-cookies";
import {
	buildClientIpAdvancedOptions,
	logClientIpConfigWarnings,
	parseTrustedClientIpHeaders,
} from "@/lib/client-ip";
import { pool } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import {
	type OtpType,
	orgInvitationEmail,
	otpEmail,
	verificationEmail,
} from "@/lib/email/templates";
import { logForwardAuthAuthzWarnings } from "@/lib/forward-auth-authz";
import { invitationAcceptRefusal } from "@/lib/invitation-accept-policy";
import { createDbGroupsLookup, getGroupsClaim } from "@/lib/oidc/groups-claim";
import { hashClientSecret } from "@/lib/oidc/hash-client-secret";
import { buildAllowInsecureRedirectUri } from "@/lib/oidc/insecure-redirect";
import { buildJwtPluginOptions } from "@/lib/oidc/issuer";
import { createOrganizationPolicy } from "@/lib/org-policy";
import {
	isSignupAllowed,
	REGISTRATION_DISABLED_ERROR,
	shouldSendSignInCode,
} from "@/lib/registration-gate";

// Extract hostname from BETTER_AUTH_URL for WebAuthn rpID
const authUrl = new URL(serverEnv.BETTER_AUTH_URL);

/**
 * Forward auth authorizes against one organization pinned by id. Without it
 * the endpoint is authentication-only, which is fine for the first rollout
 * of the image and wrong to leave in place; say so once at startup.
 */
logForwardAuthAuthzWarnings({ orgId: serverEnv.FORWARD_AUTH_ORG_ID });

/**
 * Which headers the rate limiter keys on. Getting this wrong in one direction
 * shares a bucket between every visitor; in the other it reopens the
 * X-Forwarded-For bypass upstream closed in 1.6.17. The reasoning, the
 * measured header table and the LAN residual risk live in
 * src/lib/client-ip.ts; an ambiguous configuration is warned about once here
 * at startup rather than discovered from better-auth's own fallback warning.
 */
const trustedClientIpHeaders = parseTrustedClientIpHeaders(
	serverEnv.TRUSTED_CLIENT_IP_HEADERS,
);
logClientIpConfigWarnings(trustedClientIpHeaders, {
	configured: serverEnv.TRUSTED_CLIENT_IP_HEADERS !== undefined,
	production: process.env.NODE_ENV === "production",
});

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
 * The OIDC `groups` claim: org slugs, `<slug>:role:<role>` and
 * `<slug>:team:<name>` entries. See `src/lib/oidc/groups-claim.ts`.
 */
const groupsLookup = createDbGroupsLookup(pool);

/**
 * Who may create organizations, and what a slug may look like. Shared with
 * the integration tests so they exercise this exact wiring. See
 * `src/lib/org-policy.ts`.
 */
const organizationPolicy = createOrganizationPolicy(pool);

/**
 * Turn a failed send into an APIError.
 *
 * better-auth runs every email callback through
 * `ctx.context.runInBackgroundOrAwait()`, and `advanced.backgroundTasks`
 * below makes that detach it from the request, so a throw from here never
 * reaches the HTTP client: better-auth logs it ("Failed to run background
 * task"). For invitations the send is bridged into `afterCreateInvitation`,
 * which is awaited normally and does propagate. See `parkInvitationSend`.
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
 * the members page, but the admin has to know it happened — and the callback
 * runs detached from the request (see `emailFailure`).
 *
 * So the send itself is parked here and awaited from `afterCreateInvitation`,
 * which better-auth awaits directly; a failure is rethrown there. Bounded so
 * sends on the resend path (which never reaches `afterCreateInvitation`)
 * cannot grow without limit.
 */
const MAX_PARKED_SENDS = 50;
const parkedInvitationSends = new Map<string, Promise<APIError | null>>();

function parkInvitationSend(
	invitationId: string,
	send: Promise<APIError | null>,
) {
	if (parkedInvitationSends.size >= MAX_PARKED_SENDS) {
		const oldest = parkedInvitationSends.keys().next().value;
		if (oldest) parkedInvitationSends.delete(oldest);
	}
	parkedInvitationSends.set(invitationId, send);
}

async function takeInvitationSendFailure(
	invitationId: string,
): Promise<APIError | null> {
	const send = parkedInvitationSends.get(invitationId);
	parkedInvitationSends.delete(invitationId);
	return send ?? null;
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
		// Password sign-in only. Accounts are created by email-code sign-in,
		// which proves the mailbox. A password sign-up would leave an
		// `emailVerified: false` user, and better-auth's email-code sign-in
		// deletes such a user's password, linked accounts and sessions the
		// first time they use a code (`revokeUnprovenAccountAccess`).
		disableSignUp: true,
	},

	user: {
		/**
		 * Registration gate for ENABLE_REGISTRATION=false.
		 *
		 * `validateUserInfo` (1.7.0) runs on every provisioning path. Only
		 * `create-user` is gated; `link-account` stays open for existing users.
		 */
		validateUserInfo: async ({ user, source }) => {
			if (serverEnv.ENABLE_REGISTRATION) return;
			if (source.action !== "create-user") return;

			const email = typeof user.email === "string" ? user.email : undefined;
			const allowed = await isSignupAllowed({
				enableRegistration: false,
				email,
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

	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["email-password", "email-otp"],
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

	/**
	 * Scope auth cookies to COOKIE_DOMAIN so a session minted on the auth host
	 * is sent to sibling hosts. Empty when COOKIE_DOMAIN is unset, which keeps
	 * cookies host-only for local development. See src/lib/auth-cookies.ts.
	 *
	 * `ipAddress` tells better-auth which headers may carry the client IP, for
	 * the rate limiter and the session's `ipAddress` column. See
	 * src/lib/client-ip.ts.
	 */
	advanced: {
		...buildCookieAdvancedOptions(serverEnv.COOKIE_DOMAIN),
		...buildClientIpAdvancedOptions(trustedClientIpHeaders),
		/**
		 * Detach every `runInBackgroundOrAwait` task (all email sends) from
		 * the request. Without a handler better-auth awaits them, so an
		 * endpoint that mails only real users (OTP, password reset) answered
		 * measurably slower for them than for unknown addresses. A long-lived
		 * Node server keeps running the promise after the response; the catch
		 * keeps a failure a log line, never an unhandled rejection.
		 */
		backgroundTasks: {
			handler: (task: Promise<unknown>) => {
				task.catch((error) => console.error("Background task failed:", error));
			},
		},
	},

	plugins: [
		// JWT plugin for asymmetric token signing (required for OIDC provider)
		// Must come before the oauthProvider plugin. Its `jwt.issuer` is the
		// OIDC issuer for discovery, the callback `iss` and every token's `iss`;
		// see src/lib/oidc/issuer.ts.
		...(serverEnv.ENABLE_OIDC_PROVIDER
			? [jwt(buildJwtPluginOptions(serverEnv.BETTER_AUTH_URL))]
			: []),

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
						// Loopback `http:` redirects for web clients, only when this
						// server itself runs on http loopback (dev, E2E). Off in prod.
						allowInsecureRedirectUri: buildAllowInsecureRedirectUri(
							serverEnv.BETTER_AUTH_URL,
						),
						// ID tokens no longer carry profile/email claims; consumers read
						// those from /oauth2/userinfo. `groups` is surfaced in both so
						// downstream RBAC keeps working wherever it reads it from.
						customIdTokenClaims: async ({ user, scopes }) =>
							getGroupsClaim(user.id, scopes, groupsLookup),
						customUserInfoClaims: async ({ user, scopes }) =>
							getGroupsClaim(user.id, scopes, groupsLookup),
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
		// Email codes: the default sign-in (and, for an invitee, sign-up), plus
		// email verification. A code sign-in for an unknown address creates the
		// user with a verified email, through the `validateUserInfo` gate above.
		emailOTP({
			overrideDefaultEmailVerification: true,
			async sendVerificationOTP({ email, otp, type }, ctx) {
				// Runs detached from the request (`advanced.backgroundTasks`), so
				// neither this check nor the send shows in the response time.
				if (
					type === "sign-in" &&
					!(await shouldSendSignInCode({
						enableRegistration: serverEnv.ENABLE_REGISTRATION,
						email,
						userExists: async (address) =>
							Boolean(
								await ctx?.context.internalAdapter.findUserByEmail(address),
							),
					}))
				) {
					return;
				}

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
			// Only owners/admins of an existing org (or anyone, while no org
			// exists yet) may create one. Enforced on the create endpoint; the
			// UI hides the entry via `canCreateOrganizationFn`.
			allowUserToCreateOrganization:
				organizationPolicy.allowUserToCreateOrganization,
			// Lifecycle hooks for invitation management
			organizationHooks: {
				// Slug validation on create and update (OIDC groups claim safety).
				...organizationPolicy.organizationHooks,

				/**
				 * Surface a failed invitation email to the admin who triggered it.
				 * better-auth swallows whatever `sendInvitationEmail` throws; this
				 * hook is awaited normally, so rethrowing here reaches the client.
				 * The `pending` row stays behind either way — it expires in 7 days
				 * and the members page can re-send it.
				 */
				afterCreateInvitation: async ({ invitation }) => {
					const failure = await takeInvitationSendFailure(invitation.id);
					if (failure) throw failure;
				},

				// Accepting needs a verified email: see
				// `src/lib/invitation-accept-policy.ts`.
				beforeAcceptInvitation: async ({ user }) => {
					const refusal = invitationAcceptRefusal({
						userEmailVerified: user.emailVerified,
					});
					if (refusal) throw new APIError("FORBIDDEN", { message: refusal });
				},
			},

			// Send invitation notifications
			async sendInvitationEmail(data, _ctx) {
				const inviteLink = `${serverEnv.BETTER_AUTH_URL}/invite/${data.id}`;

				// An invitation with no address has nowhere to go.
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

				const template = orgInvitationEmail({
					orgName: data.organization.name,
					inviterEmail: data.inviter.user.email,
					role: data.role,
					inviteLink,
				});

				// Parked before the first await, so `afterCreateInvitation` finds it.
				const send = sendEmail({ to: data.email, ...template }).then(
					(result) => (result.ok ? null : emailFailure(result)),
				);
				parkInvitationSend(data.id, send);
				const error = await send;
				if (error) throw error;
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
