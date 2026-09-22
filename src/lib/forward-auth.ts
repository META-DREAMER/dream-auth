/**
 * Header construction for the nginx forward-auth endpoint (`/api/verify`).
 *
 * ## Trust model
 *
 * ingress-nginx sends the *client's original request headers* to the auth
 * subrequest (`proxy_pass_request_headers on;` in the generated
 * `location = /_external-auth-...` block). A client can therefore put
 * `X-Auth-Email: admin@example.com` on its request and we will see it.
 *
 * The rule that keeps that harmless: **this endpoint derives every header from
 * the session and never reflects anything off the request.** If it echoed an
 * inbound header, ingress would faithfully copy it onto the upstream request
 * and the spoof would round-trip.
 *
 * On the protected location ingress emits, for each name in
 * `auth-response-headers`:
 *
 * ```nginx
 * auth_request_set $authHeader0 $upstream_http_x_auth_id;
 * proxy_set_header 'X-Auth-Id' $authHeader0;
 * ```
 *
 * `proxy_set_header` suppresses the client's own copy of that name (nginx skips
 * inbound headers whose name is in the proxy headers hash, regardless of
 * value), and an empty value means the header is not sent at all. So a listed
 * header fails closed: absent, never attacker-controlled. Headers we do *not*
 * list get no such treatment and pass through from the client untouched - which
 * is why downstream apps must trust only the names listed in the annotation.
 */

/**
 * Exactly the headers this endpoint emits, and exactly what belongs in
 * `nginx.ingress.kubernetes.io/auth-response-headers`.
 */
export const FORWARD_AUTH_HEADERS = [
	"X-Auth-Id",
	"X-Auth-User",
	"X-Auth-Email",
] as const;

/** The subject identifier downstream apps should key authorization on. */
export const FORWARD_AUTH_SUBJECT_HEADER = "X-Auth-Id";

/**
 * Reduce a value to something that is safe and possible to put in an HTTP
 * header.
 *
 * Two reasons this is not optional:
 * - A display name carrying CR or LF is a response-splitting attempt.
 * - `Response` headers are ByteStrings. A perfectly ordinary name like
 *   "Jose Muñoz" throws `TypeError` on construction, which would turn a
 *   successful auth check into a 500 for that one user.
 *
 * Non-ASCII is dropped rather than encoded: these headers are an identity hint
 * for downstream apps, and `X-Auth-Id` - which is always ASCII - is the value
 * that actually matters.
 */
export function sanitizeHeaderValue(value: string | null | undefined): string {
	if (typeof value !== "string") return "";
	// Keep printable ASCII only: space (0x20) through tilde (0x7e).
	return value.replace(/[^ -~]/g, "").trim();
}

export interface ForwardAuthUser {
	id: string;
	email: string;
	name?: string | null;
}

/**
 * Build the forward-auth response headers for an authenticated session.
 *
 * Every listed header is always present in the returned object, so the shape of
 * the response does not leak anything about the user, and `Cache-Control` keeps
 * the decision out of any intermediary.
 */
export function buildForwardAuthHeaders(user: ForwardAuthUser): HeadersInit {
	return {
		"X-Auth-Id": sanitizeHeaderValue(user.id),
		"X-Auth-User": sanitizeHeaderValue(user.name),
		"X-Auth-Email": sanitizeHeaderValue(user.email),
		"Cache-Control": "no-store",
	};
}
