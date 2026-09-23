/**
 * Open-redirect defence for the login/register bounce-back parameter.
 *
 * `dream-auth` is an IdP: every app behind it funnels users through
 * `/login?redirect=...`. An unvalidated parameter there is a phishing primitive
 * (`/login?redirect=https://evil.com` hands an attacker a freshly authenticated
 * user on a page that looks like it came from us), so every value that reaches
 * `window.location`, `navigate()` or `redirect()` must pass through
 * {@link sanitizeRedirect} first.
 *
 * This module is intentionally free of environment access so it can be unit
 * tested exhaustively. The policy is resolved in `./policy.env.ts` (from
 * `BETTER_AUTH_URL` / `COOKIE_DOMAIN`), used directly by the forward-auth
 * endpoint, and handed to the browser by `./policy.server.ts` via `./index.ts`.
 */

/** Where an unusable or hostile redirect target lands instead. */
export const DEFAULT_REDIRECT = "/";

/** Longest redirect target we will look at, before parsing. */
const MAX_REDIRECT_LENGTH = 2048;

/**
 * C0 controls, DEL and space. The WHATWG URL parser silently strips tab, LF and
 * CR from its input exactly like a browser does, which turns a newline-split
 * `javascript:` payload back into a `javascript:` URL. Rejecting the whole
 * class up front means the parser only ever sees what a reader would see.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point
const FORBIDDEN_CHARS = /[\u0000-\u0020\u007f]/;

/** A scheme prefix, e.g. `https:`, `javascript:`, `a+b.c-d:`. */
const SCHEME_PREFIX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export interface RedirectPolicy {
	/**
	 * Origin of this auth server, e.g. `https://auth.example.com`. Relative
	 * targets resolve against it and it is always an allowed destination.
	 */
	origin: string;
	/**
	 * Cookie domain the session is scoped to, e.g. `.example.com`. Sibling hosts
	 * under it are allowed destinations, which is the forward-auth case: nginx
	 * bounces a user from `app.example.com` to us and we have to send them back.
	 *
	 * When unset (local development, single-host deployments) only the auth
	 * origin itself is allowed.
	 */
	cookieDomain?: string;
}

/** Strip a leading `.` (cookie-domain form) and a trailing FQDN dot. */
function normalizeDomain(value: string): string {
	return value.trim().toLowerCase().replace(/^\./, "").replace(/\.$/, "");
}

function isAllowedHost(target: URL, base: URL, cookieDomain?: string): boolean {
	// The auth server itself, scheme and port included.
	if (target.origin === base.origin) return true;

	if (!cookieDomain) return false;

	const domain = normalizeDomain(cookieDomain);

	// A cookie domain with no dot (`com`, `localhost`, or an empty string after
	// normalisation) would open the door to every host under a public suffix.
	if (!domain.includes(".")) return false;

	// The URL parser lowercases hostnames; only a root dot can remain.
	const host = target.hostname.replace(/\.$/, "");

	return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Validate an attacker-controlled redirect target and return something safe to
 * hand to `window.location` or the router.
 *
 * Accepted:
 * - same-origin rooted paths (`/org/members?tab=1#x`), returned as paths
 * - absolute `https://` URLs whose host is the cookie domain or a subdomain
 * - absolute URLs on the auth origin itself, whatever scheme that origin uses,
 *   so `http://localhost:3000` still works in development
 *
 * Everything else - protocol-relative `//evil.com`, off-domain hosts,
 * `javascript:` and `data:`, embedded credentials, backslash and
 * control-character tricks - collapses to {@link DEFAULT_REDIRECT}.
 */
export function sanitizeRedirect(
	raw: string | null | undefined,
	policy: RedirectPolicy,
): string {
	if (typeof raw !== "string") return DEFAULT_REDIRECT;

	const value = raw.trim();
	if (!value || value.length > MAX_REDIRECT_LENGTH) return DEFAULT_REDIRECT;
	if (FORBIDDEN_CHARS.test(value)) return DEFAULT_REDIRECT;

	// Only two shapes are meaningful: a rooted path, or an absolute URL with a
	// scheme. A bare `evil.com` would otherwise resolve to `/evil.com` - safe,
	// but never something we meant to emit.
	if (!value.startsWith("/") && !SCHEME_PREFIX.test(value)) {
		return DEFAULT_REDIRECT;
	}

	let base: URL;
	try {
		base = new URL(policy.origin);
	} catch {
		return DEFAULT_REDIRECT;
	}

	let target: URL;
	try {
		target = new URL(value, base);
	} catch {
		return DEFAULT_REDIRECT;
	}

	// `https://auth.example.com@evil.com/` parses with host `evil.com`, so the
	// host check below already catches it - but userinfo has no legitimate place
	// in a redirect target and reads as a disguise, so it is rejected outright.
	if (target.username || target.password) return DEFAULT_REDIRECT;

	// Kills javascript:, data:, blob:, mailto:, vbscript:, file:, ...
	if (target.protocol !== "http:" && target.protocol !== "https:") {
		return DEFAULT_REDIRECT;
	}

	if (!isAllowedHost(target, base, policy.cookieDomain)) {
		return DEFAULT_REDIRECT;
	}

	// Cross-origin destinations must be TLS. The auth origin itself is exempt so
	// that plain-http local development still works.
	if (target.origin !== base.origin && target.protocol !== "https:") {
		return DEFAULT_REDIRECT;
	}

	// Keep same-origin targets relative: the router can navigate them in place,
	// and the emitted value stays obviously local.
	if (target.origin === base.origin) {
		return `${target.pathname}${target.search}${target.hash}`;
	}

	return target.toString();
}

/**
 * Pick the bounce-back target out of a search object.
 *
 * `redirect` is this app's own parameter; `rd` is the ingress-nginx convention
 * (`auth-signin-redirect-param` defaults to `rd`, and the controller appends
 * `?rd=<absolute url>` to `auth-signin` when the annotation carries no query of
 * its own). Both are accepted so a hand-written annotation works either way,
 * with `redirect` winning when both are present. Both go through
 * {@link sanitizeRedirect}.
 */
export function resolveRedirectTarget(
	search: { redirect?: string | undefined; rd?: string | undefined },
	policy: RedirectPolicy,
): string {
	return sanitizeRedirect(search.redirect ?? search.rd, policy);
}

/**
 * True when a sanitized target is a same-origin path, i.e. something the router
 * can navigate to. Cross-subdomain targets need a document navigation instead.
 */
export function isInternalRedirect(target: string): boolean {
	return target.startsWith("/") && !target.startsWith("//");
}
