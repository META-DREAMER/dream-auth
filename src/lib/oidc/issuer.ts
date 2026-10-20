import type { JwtOptions } from "better-auth/plugins";

/**
 * The OIDC issuer: the origin of BETTER_AUTH_URL, e.g. `https://auth.md.wtf`
 * (Option B from the PRD: the issuer sits at the root, not under /api/auth).
 *
 * Discovery `issuer`, the RFC 9207 `iss` authorization-response parameter and
 * the `iss` claim of every ID and access token must be the same string (OIDC
 * Discovery §3, Core §3.1.3.7). @better-auth/oauth-provider takes all of
 * them from the jwt plugin's `jwt.issuer`, falling back to `baseURL`, which
 * includes the `/api/auth` base path. Setting it here keeps them in step.
 */
export function getOidcIssuer(betterAuthUrl: string): string {
	return new URL(betterAuthUrl).origin;
}

/** Options for better-auth's `jwt()` plugin, pinned to the OIDC issuer. */
export function buildJwtPluginOptions(betterAuthUrl: string): JwtOptions {
	return { jwt: { issuer: getOidcIssuer(betterAuthUrl) } };
}
