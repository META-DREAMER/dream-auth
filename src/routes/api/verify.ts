import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";
import {
	buildForwardAuthHeaders,
	buildForwardedReturnTo,
	FORWARD_AUTH_MODE_PARAM,
	FORWARD_AUTH_MODE_REDIRECT,
	isNavigationMethod,
} from "@/lib/forward-auth";
import { DEFAULT_REDIRECT, sanitizeRedirect } from "@/lib/redirect/policy";
import { getRedirectPolicy } from "@/lib/redirect/policy.env";
import type { ServerRouteHandler } from "@/lib/server-handler";

/**
 * Forward-auth endpoint for nginx `auth-url` and Traefik `forwardAuth`.
 *
 * - `200` with `X-Auth-Id` / `X-Auth-User` / `X-Auth-Email` for a valid session
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
 * - `503` when the session cannot be checked at all
 *
 * The identity headers are derived from the session alone. Nothing is
 * reflected off the request - ingress forwards the *client's* headers to this
 * subrequest - see `src/lib/forward-auth.ts` for the trust model and
 * `docs/KUBERNETES.md` for the proxy config that makes it safe. The one thing
 * that *is* read off the request, the `X-Forwarded-*` return-to, is
 * attacker-influenceable via `X-Forwarded-Host` and goes through the same
 * `sanitizeRedirect` policy as `/login?redirect=`: only the auth origin and
 * hosts under `COOKIE_DOMAIN` survive, everything else collapses to `/`.
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
		return new Response(null, {
			status: 503,
			headers: { "Cache-Control": "no-store" },
		});
	}

	if (!session?.user) {
		if (shouldRedirectToLogin(request)) {
			return new Response(null, {
				status: 302,
				headers: {
					Location: buildLoginUrl(request.headers),
					"Cache-Control": "no-store",
				},
			});
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

	return new Response(null, {
		status: 200,
		headers: buildForwardAuthHeaders(session.user),
	});
};

/**
 * Redirect mode is opt-in on the verify URL and only for navigations. The
 * original method arrives in `X-Forwarded-Method` (Traefik always issues the
 * auth subrequest itself as a `GET`); a missing header means we cannot tell,
 * and a `302` is the wrong answer to a `POST`, so that case stays a `401`.
 */
function shouldRedirectToLogin(request: Request): boolean {
	const mode = new URL(request.url).searchParams.get(FORWARD_AUTH_MODE_PARAM);
	if (mode !== FORWARD_AUTH_MODE_REDIRECT) return false;
	return isNavigationMethod(request.headers.get("X-Forwarded-Method"));
}

/**
 * Absolute URL to our login page, carrying the sanitized return-to. Absolute
 * because the browser receives this `302` from the *app's* host - a relative
 * `Location` would resolve against `app.example.com`, not us.
 */
function buildLoginUrl(headers: Headers): string {
	const policy = getRedirectPolicy();
	const candidate = buildForwardedReturnTo(headers);
	const target = candidate
		? sanitizeRedirect(candidate, policy)
		: DEFAULT_REDIRECT;

	const login = new URL("/login", policy.origin);
	if (target !== DEFAULT_REDIRECT) {
		login.searchParams.set("redirect", target);
	}
	return login.toString();
}

export const Route = createFileRoute("/api/verify")({
	server: {
		handlers: { GET },
	},
});
