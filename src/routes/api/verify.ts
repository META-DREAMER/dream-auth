import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";
import {
	buildForwardAuthHeaders,
	buildForwardedReturnTo,
	FORWARD_AUTH_MODE_PARAM,
	FORWARD_AUTH_MODE_REDIRECT,
	isNavigationMethod,
} from "@/lib/forward-auth";
import {
	type AuthzRequirement,
	authorize,
	parseAuthzRequirement,
} from "@/lib/forward-auth-authz";
import { getForwardAuthOrgId, orgAccessLookup } from "@/lib/org-access";
import { DEFAULT_REDIRECT, sanitizeRedirect } from "@/lib/redirect/policy";
import { getRedirectPolicy } from "@/lib/redirect/policy.env";
import type { ServerRouteHandler } from "@/lib/server-handler";

/**
 * Forward-auth endpoint for nginx `auth-url` and Traefik `forwardAuth`.
 *
 * - `200` with `X-Auth-Id` / `X-Auth-User` / `X-Auth-Email` / `X-Auth-Groups`
 *   for a valid session that is authorized for this app
 * - `401` with no identity headers for no session, an expired session, or a
 *   session whose user was deleted (Better Auth's `getSession` returns null for
 *   all three: it re-reads the `session` row on every call, and the row is
 *   removed with the user)
 * - `302` to `/login?redirect=<original url>` instead of that `401` when the
 *   verify URL carries `?mode=redirect` and the original request was a `GET` or
 *   `HEAD`. This is the Traefik path: `forwardAuth` returns any non-2xx auth
 *   response to the client as-is, so the sign-in bounce has to be ours, and
 *   the original URL has to be rebuilt from `X-Forwarded-Proto/Host/Uri`
 *   because Traefik never appends an `rd`-style parameter. nginx must *not*
 *   use this mode: `auth_request` treats anything but 2xx/401/403 as an error.
 * - `403` with no identity headers for a valid session that is *not*
 *   authorized: not a member of `FORWARD_AUTH_ORG_ID`, or lacking the `team=`
 *   / `role=admin` the verify URL asks for. In redirect mode a navigation gets
 *   a `302` to our `/forbidden` page instead, which says who is signed in and
 *   offers to switch account.
 * - `503` when the session or membership cannot be checked at all
 *
 * The identity headers are derived from the session alone. Nothing is
 * reflected off the request - ingress forwards the *client's* headers to this
 * subrequest - see `src/lib/forward-auth.ts` for the trust model and
 * `docs/KUBERNETES.md` for the proxy config that makes it safe. The one thing
 * that *is* read off the request, the `X-Forwarded-*` return-to, is
 * attacker-influenceable via `X-Forwarded-Host` and goes through the same
 * `sanitizeRedirect` policy as `/login?redirect=`: only the auth origin and
 * hosts under `COOKIE_DOMAIN` survive, everything else collapses to `/`.
 *
 * The authorization requirement (`team=`, `role=`) is read from *this*
 * request's URL, which the proxy copies from its own middleware config. It is
 * never read from `X-Forwarded-Uri`, which is the client's URL.
 */
export const GET: ServerRouteHandler = async ({ request }) => {
	let session: Awaited<ReturnType<typeof auth.api.getSession>>;

	try {
		session = await auth.api.getSession({ headers: request.headers });
	} catch (error) {
		// A database outage must not read as "authenticated". A 5xx makes the
		// proxy deny the request without bouncing the user through a sign-in
		// that cannot succeed, and keeps the failure legible in the logs.
		console.error("[ForwardAuth] session lookup failed:", error);
		return unavailable();
	}

	if (!session?.user) {
		if (isRedirectableNavigation(request)) {
			return redirectTo(buildLoginUrl(request.headers));
		}

		// No identity headers on this path. nginx only copies the listed names
		// off a 2xx auth response, and any header we emit that is not in
		// `auth-response-headers` would be a spoofing surface rather than a
		// signal.
		return new Response(null, {
			status: 401,
			headers: { "Cache-Control": "no-store" },
		});
	}

	const requirement = parseAuthzRequirement(new URL(request.url));
	const orgId = getForwardAuthOrgId();

	if (!orgId) {
		// Legacy mode: authentication only. A requirement on the verify URL
		// cannot be evaluated without an org to evaluate it against, and
		// "cannot evaluate" must never read as "allowed".
		if (requirement.kind !== "member") {
			console.warn(
				"[ForwardAuth] denied: verify URL carries a requirement but FORWARD_AUTH_ORG_ID is not set",
			);
			return forbidden(request);
		}
		return new Response(null, {
			status: 200,
			headers: buildForwardAuthHeaders(session.user),
		});
	}

	let decision: ReturnType<typeof authorize>;
	try {
		const access = await orgAccessLookup.getOrgAccess(session.user.id, orgId);
		decision = authorize(access, requirement);
	} catch (error) {
		console.error("[ForwardAuth] membership lookup failed:", error);
		return unavailable();
	}

	if (!decision.allowed) {
		console.warn(
			`[ForwardAuth] denied user ${session.user.id} for ${describeRequirement(requirement)}: ${decision.reason}`,
		);
		return forbidden(request);
	}

	return new Response(null, {
		status: 200,
		headers: buildForwardAuthHeaders(session.user, decision.groups),
	});
};

function unavailable(): Response {
	return new Response(null, {
		status: 503,
		headers: { "Cache-Control": "no-store" },
	});
}

function redirectTo(location: string): Response {
	return new Response(null, {
		status: 302,
		headers: { Location: location, "Cache-Control": "no-store" },
	});
}

/**
 * Signed in but not allowed. A navigation in redirect mode lands on our own
 * `/forbidden` page, so the user learns which account they are on and can
 * switch; everything else gets the bare status, which both proxies pass
 * through to the client unchanged.
 */
function forbidden(request: Request): Response {
	if (isRedirectableNavigation(request)) {
		return redirectTo(buildForbiddenUrl(request.headers));
	}
	return new Response(null, {
		status: 403,
		headers: { "Cache-Control": "no-store" },
	});
}

function describeRequirement(requirement: AuthzRequirement): string {
	switch (requirement.kind) {
		case "member":
			return "org membership";
		case "role":
			return `role=${requirement.role}`;
		case "team":
			return `team=${requirement.team}`;
		case "invalid":
			return "an invalid requirement";
	}
}

/**
 * Redirect mode is opt-in on the verify URL and only for navigations. The
 * original method arrives in `X-Forwarded-Method` (Traefik always issues the
 * auth subrequest itself as a `GET`); a missing header means we cannot tell,
 * and a `302` is the wrong answer to a `POST`, so that case stays a bare
 * status.
 */
function isRedirectableNavigation(request: Request): boolean {
	const mode = new URL(request.url).searchParams.get(FORWARD_AUTH_MODE_PARAM);
	if (mode !== FORWARD_AUTH_MODE_REDIRECT) return false;
	return isNavigationMethod(request.headers.get("X-Forwarded-Method"));
}

/**
 * The sanitized return-to for this request, or `DEFAULT_REDIRECT` when the
 * forwarded headers are absent, malformed or hostile.
 */
function resolveReturnTo(headers: Headers): string {
	const candidate = buildForwardedReturnTo(headers);
	return candidate
		? sanitizeRedirect(candidate, getRedirectPolicy())
		: DEFAULT_REDIRECT;
}

/**
 * Absolute URL to our login page, carrying the sanitized return-to. Absolute
 * because the browser receives this `302` from the *app's* host - a relative
 * `Location` would resolve against `app.example.com`, not us.
 */
function buildLoginUrl(headers: Headers): string {
	const login = new URL("/login", getRedirectPolicy().origin);
	const target = resolveReturnTo(headers);
	if (target !== DEFAULT_REDIRECT) {
		login.searchParams.set("redirect", target);
	}
	return login.toString();
}

/**
 * Absolute URL to our forbidden page. The `redirect` parameter is the same
 * sanitized return-to the login page gets, so the page can name the app the
 * user was denied and send them back to it after they switch accounts. A
 * hostile `X-Forwarded-Host` collapses to no parameter at all - the raw host
 * is never reflected.
 */
function buildForbiddenUrl(headers: Headers): string {
	const page = new URL("/forbidden", getRedirectPolicy().origin);
	const target = resolveReturnTo(headers);
	if (target !== DEFAULT_REDIRECT) {
		page.searchParams.set("redirect", target);
	}
	return page.toString();
}

export const Route = createFileRoute("/api/verify")({
	server: {
		handlers: { GET },
	},
});
