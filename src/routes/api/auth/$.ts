import { createFileRoute } from "@tanstack/react-router";
import { serverEnv, serverEnvWithOidc } from "@/env";
import { auth } from "@/lib/auth";
import { ensureOidcClientsSeeded } from "@/lib/oidc/sync-oidc-clients";

/**
 * Ensure OIDC clients are seeded to DB before handling auth requests.
 * Uses a sync flag to skip the async call entirely after first success,
 * avoiding unnecessary microtask overhead on every auth request.
 *
 * @see https://github.com/better-auth/better-auth/issues/6649
 */
let oidcReady = false;

async function ensureOidcReady(): Promise<void> {
	if (oidcReady || !serverEnv.ENABLE_OIDC_PROVIDER) {
		return;
	}
	await ensureOidcClientsSeeded(serverEnvWithOidc.OIDC_CLIENTS);
	oidcReady = true;
}

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				await ensureOidcReady();
				return auth.handler(request);
			},
			POST: async ({ request }) => {
				await ensureOidcReady();
				return auth.handler(request);
			},
		},
	},
});
