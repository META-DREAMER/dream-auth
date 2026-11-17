/**
 * `allowInsecureRedirectUri` for the OAuth provider.
 *
 * As of @better-auth/oauth-provider 1.7.25 (not in 1.7.5), a `web` client's `http:` redirect
 * URI is rejected even on loopback ("Redirect URI must use HTTPS (HTTP allowed
 * only for loopback hosts)") unless this callback accepts it. Production
 * (`https://auth.md.wtf`) needs none, so it is enabled only when the server
 * itself runs on plain-HTTP loopback - local development and the E2E suite -
 * and then accepts only loopback redirect URIs.
 *
 * @returns the callback, or `undefined` to keep the strict default
 */
export function buildAllowInsecureRedirectUri(
	betterAuthUrl: string,
): ((url: URL) => boolean) | undefined {
	const server = new URL(betterAuthUrl);
	if (server.protocol !== "http:" || !isLoopbackHostname(server.hostname)) {
		return undefined;
	}
	return (url) => url.protocol === "http:" && isLoopbackHostname(url.hostname);
}

function isLoopbackHostname(hostname: string): boolean {
	return (
		hostname === "localhost" ||
		hostname.endsWith(".localhost") ||
		hostname === "[::1]" ||
		/^127(?:\.\d{1,3}){3}$/.test(hostname)
	);
}
