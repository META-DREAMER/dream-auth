import { createFileRoute } from "@tanstack/react-router";
import { serverEnv, serverEnvWithOidc } from "@/env";
import { auth } from "@/lib/auth";
import { ensureOidcClientsSeeded } from "@/lib/oidc/sync-oidc-clients";

/**
 * Ensure OIDC clients are seeded to DB before handling auth requests.
 * This guarantees FK integrity for /oauth2/token when using trustedClients.
 *
 * @see https://github.com/better-auth/better-auth/issues/6649
 */
async function ensureOidcReady(): Promise<void> {
	if (serverEnv.ENABLE_OIDC_PROVIDER) {
		await ensureOidcClientsSeeded(serverEnvWithOidc.OIDC_CLIENTS);
	}
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
