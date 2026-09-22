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
 *
 * Server-only: it reads `serverEnv`. Server routes (the forward-auth endpoint)
 * import it directly; the browser gets the same value through
 * `getRedirectPolicyFn` in `./policy.server.ts`. Kept apart from that file on
 * purpose - the client build strips `createServerFn` handlers and tree-shakes
 * whatever they alone referenced, and a plain export next to one would drag
 * `serverEnv` (and `node:fs`) into the browser bundle.
 */
export function getRedirectPolicy(): RedirectPolicy {
	return {
		origin: new URL(serverEnv.BETTER_AUTH_URL).origin,
		cookieDomain: serverEnv.COOKIE_DOMAIN,
	};
}
