import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";
import { buildForwardAuthHeaders } from "@/lib/forward-auth";
import type { ServerRouteHandler } from "@/lib/server-handler";

/**
 * Forward-auth endpoint for nginx `auth-url`.
 *
 * - `200` with `X-Auth-Id` / `X-Auth-User` / `X-Auth-Email` for a valid session
 * - `401` with no identity headers for no session, an expired session, or a
 *   session whose user was deleted (Better Auth's `getSession` returns null for
 *   all three: it re-reads the `session` row on every call, and the row is
 *   removed with the user)
 * - `503` when the session cannot be checked at all
 *
 * Every response is derived from the session alone. Nothing is reflected off
 * the request, which matters because ingress forwards the *client's* headers to
 * this subrequest - see `src/lib/forward-auth.ts` for the trust model and
 * `docs/KUBERNETES.md` for the annotation set that makes it safe.
 */
export const GET: ServerRouteHandler = async ({ request }) => {
	let session: Awaited<ReturnType<typeof auth.api.getSession>>;

	try {
		session = await auth.api.getSession({ headers: request.headers });
	} catch (error) {
		// A database outage must not read as "authenticated". A 5xx makes nginx
		// deny the request without bouncing the user through a sign-in that
		// cannot succeed, and keeps the failure legible in the logs.
		console.error("[ForwardAuth] session lookup failed:", error);
		return new Response(null, {
			status: 503,
			headers: { "Cache-Control": "no-store" },
		});
	}

	if (!session?.user) {
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

export const Route = createFileRoute("/api/verify")({
	server: {
		handlers: { GET },
	},
});
