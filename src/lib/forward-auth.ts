/**
 * Header handling for the forward-auth endpoint (`/api/verify`): the identity
 * headers it emits, and the return-to URL it rebuilds from Traefik's
 * `X-Forwarded-*` headers.
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

/**
 * Query parameter on the verify URL that selects what an unauthenticated
 * request gets back. Absent (or any other value): `401`, which is what nginx
 * `auth-url` needs because the controller turns it into its own redirect to
 * `auth-signin?rd=...`. `redirect`: a `302` to our login page, which is what
 * Traefik `forwardAuth` needs because it hands any non-2xx auth response to the
 * client verbatim and never adds a return-to of its own.
 */
export const FORWARD_AUTH_MODE_PARAM = "mode";
export const FORWARD_AUTH_MODE_REDIRECT = "redirect";

/**
 * Original request methods that are a browser navigation and may therefore be
 * bounced through the login page. Anything else (a `POST` form submit, an
 * `OPTIONS` preflight, a `PUT` from a client library) has no page to come back
 * to, and a `302` would only turn its failure into a confusing one.
 */
const NAVIGATION_METHODS = new Set(["GET", "HEAD"]);

export function isNavigationMethod(method: string | null | undefined): boolean {
	return (
		typeof method === "string" &&
		NAVIGATION_METHODS.has(method.trim().toUpperCase())
	);
}

/**
 * `host` or `host:port`, where host is a DNS name. Deliberately narrow: it is
 * the only place the attacker-influenceable `X-Forwarded-Host` is read, so the
 * cheap syntactic check rejects list values (`a.example.com, evil.com`),
 * userinfo, IP literals and anything else the URL parser might reinterpret
 * before the redirect policy ever looks at the result.
 */
const FORWARDED_HOST =
	/^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?)*\.?(:\d{1,5})?$/i;

/**
 * Rebuild the URL the user originally asked for from the headers Traefik's
 * `forwardAuth` middleware sends to the auth server (`X-Forwarded-Proto`,
 * `-Host`, `-Uri`; see `docs/KUBERNETES.md`).
 *
 * This is a *raw* candidate. It must go through `sanitizeRedirect` before it
 * is emitted, because `X-Forwarded-Host` is whatever the client sent when the
 * entrypoint trusts forwarded headers, and even when it does not, `Host` is
 * client-chosen on a wildcard route. Returns `null` when the headers are absent
 * or malformed enough that there is nothing sensible to return to; the caller
 * then falls back to the default target.
 */
export function buildForwardedReturnTo(headers: Headers): string | null {
	const proto = headers.get("X-Forwarded-Proto")?.trim().toLowerCase();
	const host = headers.get("X-Forwarded-Host")?.trim();
	const uri = headers.get("X-Forwarded-Uri")?.trim() || "/";

	if (proto !== "http" && proto !== "https") return null;
	if (!host || !FORWARDED_HOST.test(host)) return null;
	// A dotted-quad passes the DNS-name shape but is never the cookie domain.
	if (/^[\d.]+(:\d+)?$/.test(host)) return null;

	// A request-target is always origin-form here (`/path?query`). Anything
	// else - `//evil.com`, `https:evil`, `\evil` - is not a path on `host` and
	// must not be concatenated into one. Keep the origin, drop the path.
	const path = uri.startsWith("/") && !/^[/\\]{2}/.test(uri) ? uri : "/";

	return `${proto}://${host}${path}`;
}
