import { createHash } from "node:crypto";

/**
 * Hash an OAuth client secret for storage in `oauthClient.clientSecret`.
 *
 * `@better-auth/oauth-provider` never stores secrets in plain text. It is
 * wired to this function through `storeClientSecret: { hash: hashClientSecret }`
 * in `src/lib/auth.ts`, and the config seeder in `sync-oidc-clients.ts` uses
 * the same function, so a seeded row verifies against the secret the client
 * presents.
 *
 * The algorithm (SHA-256, base64url, unpadded) matches the library's own
 * default hasher. Passing it explicitly means the seeder and the verifier can
 * never drift apart across a library upgrade.
 *
 * Changing this function invalidates every already-seeded secret; the rows are
 * re-seeded from config on startup, so that is recoverable, but it will break
 * live clients until the next boot.
 */
export function hashClientSecret(clientSecret: string): string {
	return createHash("sha256").update(clientSecret, "utf8").digest("base64url");
}
