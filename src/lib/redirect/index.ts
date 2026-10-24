import {
	DEFAULT_REDIRECT,
	isInternalRedirect,
	isOAuthContinuation,
	type RedirectPolicy,
	resolveRedirectTarget,
} from "./policy";
import { getRedirectPolicyFn } from "./policy.server";

export {
	DEFAULT_REDIRECT,
	isInternalRedirect,
	isOAuthContinuation,
	type RedirectPolicy,
	resolveRedirectTarget,
	sanitizeRedirect,
} from "./policy";

/**
 * Cached for the lifetime of the tab. The policy is derived from deployment
 * configuration that cannot change without restarting the server, so one fetch
 * per page load is one too many already.
 */
let policyPromise: Promise<RedirectPolicy> | null = null;

function fetchRedirectPolicy(): Promise<RedirectPolicy> {
	policyPromise ??= getRedirectPolicyFn().catch((error) => {
		// Never leave the cache poisoned with a rejected promise, and never fall
		// back to something permissive: an unreachable policy means "/" only.
		policyPromise = null;
		throw error;
	});
	return policyPromise;
}

/**
 * Resolve the bounce-back target for a login/register style search object.
 *
 * Accepts both `redirect` (ours) and `rd` (the ingress-nginx convention), runs
 * the winner through the open-redirect validator, and falls back to
 * {@link DEFAULT_REDIRECT} for anything hostile, malformed, or unreachable.
 *
 * Call this in `beforeLoad` and put the result in route context: the pages
 * render client-side, so resolving once up front keeps the submit handlers
 * synchronous.
 */
export async function resolveSafeRedirect(search: {
	redirect?: string | undefined;
	rd?: string | undefined;
}): Promise<string> {
	if (!search.redirect && !search.rd) return DEFAULT_REDIRECT;

	try {
		return resolveRedirectTarget(search, await fetchRedirectPolicy());
	} catch {
		return DEFAULT_REDIRECT;
	}
}

/**
 * Navigate to an already-sanitized target.
 *
 * Cross-subdomain targets need a document navigation; same-origin paths get one
 * too, because every caller here is finishing a sign-in and a fresh document
 * picks up the new session cookie without any router-cache subtleties.
 *
 * Only ever call this with the output of {@link resolveSafeRedirect}.
 */
export function navigateToSafeRedirect(target: string): void {
	if (typeof window === "undefined") return;
	window.location.assign(
		isInternalRedirect(target) ? target : new URL(target).toString(),
	);
}

/**
 * Finish a sign-in started on `/login`.
 *
 * `data` is the sign-in response body. When the page was reached from the
 * OAuth authorize endpoint it is an {@link isOAuthContinuation} body and
 * better-auth's redirect fetch plugin is already navigating to the app's
 * callback. Navigating to `target` as well would race it, and a caller that
 * awaits the sign-in wins that race, landing the user on our home page instead
 * of back in the app that asked them to sign in.
 */
export function navigateAfterSignIn(data: unknown, target: string): void {
	if (isOAuthContinuation(data)) return;
	navigateToSafeRedirect(target);
}
