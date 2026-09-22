import { createServerFn } from "@tanstack/react-start";
import type { RedirectPolicy } from "./policy";
import { getRedirectPolicy } from "./policy.env";

/**
 * Hands the policy to the browser.
 *
 * The login and register pages render client-side, so they cannot read
 * `serverEnv`. They fetch this once in `beforeLoad` and cache it for the tab
 * (see `./index.ts`); it holds no secrets, only the origin the user is already
 * looking at and the cookie domain the browser can read off its own cookies.
 */
export const getRedirectPolicyFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<RedirectPolicy> => getRedirectPolicy(),
);
