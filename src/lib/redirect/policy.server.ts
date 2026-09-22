import { createServerFn } from "@tanstack/react-start";
import { serverEnv } from "@/env";
import type { RedirectPolicy } from "./policy";

/**
 * The redirect policy, derived from configuration that already exists.
 *
 * `BETTER_AUTH_URL` is this server's own origin and `COOKIE_DOMAIN` is the
 * domain the session cookie is scoped to - i.e. exactly the set of hosts that
 * can already act as this user. Deliberately the same pair `src/lib/auth.ts`
 * feeds to `trustedOrigins`, so a sibling app that is allowed to drive the auth
 * endpoints is also a legal bounce-back target, and nothing else is.
 */
function getRedirectPolicy(): RedirectPolicy {
	return {
		origin: new URL(serverEnv.BETTER_AUTH_URL).origin,
		cookieDomain: serverEnv.COOKIE_DOMAIN,
	};
}

/**
 * Hands the policy to the browser.
 *
 * The login and register pages render client-side, so they cannot read
 * `serverEnv`. They fetch this once in `beforeLoad` and cache it for the tab
 * (see `./use-safe-redirect.ts`); it holds no secrets, only the origin the user
 * is already looking at and the cookie domain the browser can read off its own
 * cookies.
 */
export const getRedirectPolicyFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<RedirectPolicy> => getRedirectPolicy(),
);
