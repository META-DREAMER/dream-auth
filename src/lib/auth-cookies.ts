/**
 * Cookie scoping for cross-subdomain SSO.
 *
 * A session minted on `auth.example.com` is host-only by default, so it is not
 * sent to `app.example.com` and single sign-on across the estate does not work.
 * better-auth's supported fix is `advanced.crossSubDomainCookies`, which stamps
 * a `Domain` attribute onto every auth cookie it issues — not just the session
 * token, but `session_data`, `account_data` and `dont_remember` too.
 *
 * The domain has to be given explicitly. With `enabled: true` and no `domain`,
 * better-auth falls back to the base URL's hostname (`auth.example.com`), which
 * is the host-only behaviour we are trying to escape.
 *
 * Everything else is left to better-auth's defaults, which already give
 * `httpOnly: true`, `sameSite: "lax"`, `path: "/"` and a `secure` flag derived
 * from the base URL's protocol.
 */

export type CookieAdvancedOptions = {
	crossSubDomainCookies?: {
		enabled: boolean;
		domain?: string;
	};
};

/**
 * Build the `advanced` fragment that scopes cookies to `cookieDomain`.
 *
 * Returns an empty object when no domain is configured. That is the local-dev
 * path: cookies stay host-only and work on `localhost`, which no `Domain`
 * attribute can usefully describe.
 */
export function buildCookieAdvancedOptions(
	cookieDomain: string | undefined,
): CookieAdvancedOptions {
	// A leading dot is legal but legacy — RFC 6265 tells user agents to ignore
	// it. Stripped here so the attribute matches the form used for
	// `trustedOrigins`, which is built from the same variable.
	const domain = cookieDomain?.replace(/^\./, "").trim();

	if (!domain) return {};

	return { crossSubDomainCookies: { enabled: true, domain } };
}
