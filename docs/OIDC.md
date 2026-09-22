# OIDC Provider Implementation

Provided by `@better-auth/oauth-provider`, a separate package since Better Auth
1.7.0 removed the built-in `oidcProvider` plugin.

## Why clients are seeded to the database

The 1.7 plugin has no `trustedClients` option. Every client - including a
trusted one that skips consent - must exist as a row in the `oauthClient`
table. `cachedTrustedClients` on the plugin only marks which of those rows may
be cached in memory (and are therefore immutable through the CRUD endpoints);
it does not define them.

So DB seeding is no longer a workaround for
[#6649](https://github.com/better-auth/better-auth/issues/6649) - it is the
only supported way to register a config-driven client.

## Architecture

### 1. Configuration loading (`src/lib/oidc/config.ts`)

- Loads clients from `OIDC_CLIENTS` env var (JSON array)
- Loads clients from `OIDC_CLIENTS_FILE` (for Kubernetes ConfigMaps)
- Validates with Zod schema (`src/lib/oidc/schemas.ts`)
- Merges both sources and checks for duplicate client IDs
- Fail-fast in production on errors

### 2. Client configuration shape (`src/lib/oidc/schemas.ts`)

| Field | Notes |
| --- | --- |
| `clientId`, `name`, `redirectURLs` | Required |
| `clientSecret` | Required unless `tokenEndpointAuthMethod` is `none` |
| `applicationType` | `web` (default) or `native`. Redirect-URI policy only |
| `tokenEndpointAuthMethod` | `client_secret_basic` (default), `client_secret_post`, or `none` |
| `grantTypes` | Defaults to `["authorization_code", "refresh_token"]` |
| `responseTypes` | Defaults to `["code"]` |
| `scopes` | Optional allowlist; omit to allow every provider scope |
| `requirePKCE` | Optional per-client override of `OIDC_REQUIRE_PKCE` |
| `skipConsent`, `disabled`, `icon`, `metadata`, `userId` | Optional |

The pre-1.7 `type` field (`web` / `native` / `user-agent-based` / `public`) is
still accepted and mapped onto `applicationType` + `tokenEndpointAuthMethod`,
so existing ConfigMaps keep working. `web` maps to a confidential client using
`client_secret_basic`; every other legacy value maps to a public client
(`none`).

**`tokenEndpointAuthMethod` is enforced strictly.** A client registered for
`client_secret_basic` that sends its credentials in the POST body is rejected
with `invalid_client`. If a downstream app fails to exchange its code, this is
the first thing to check.

### 3. Database seeding (`src/lib/oidc/sync-oidc-clients.ts`)

- Upserts each configured client into the `oauthClient` table on startup
- Writes through the Better Auth database adapter, not raw SQL, so array
  columns (`redirectUris`, `grantTypes`, ...) and the JSON `metadata` column
  are serialized exactly the way the plugin reads them back
- Hashes `clientSecret` with `hashClientSecret` (`src/lib/oidc/hash-client-secret.ts`),
  the same function passed to the plugin as `storeClientSecret.hash`. Secrets
  are never stored in plain text
- A unique-key violation on insert (two pods racing on first boot) falls back
  to an update rather than failing startup
- Singleton promise ensures seeding only runs once per process

### 4. Environment configuration (`src/env.ts`)

- `serverEnvWithOidc.OIDC_CLIENTS` provides merged, validated clients
- Lazy-loaded and cached after first access
- Logs loaded client IDs (never secrets)

### 5. Better Auth integration (`src/lib/auth.ts`)

- `jwt()` must come before `oauthProvider()`
- `cachedTrustedClients` is the set of configured client IDs
- `customIdTokenClaims` / `customUserInfoClaims` supply the `groups` claim

## Claims

ID tokens no longer carry profile or email claims. Consumers must call
`/oauth2/userinfo` for those. The `groups` claim (organization slugs, for RBAC
in ArgoCD, Grafana, ...) is supplied on both the ID token and UserInfo, so
downstream apps keep working wherever they read it from.

## Troubleshooting

**Client not found, or FK error on token exchange:**

1. Ensure `ENABLE_OIDC_PROVIDER=true` is set
2. Check logs for "Seeding N client(s) to database" on startup
3. Verify the `oauthClient` table has your client (query DB)

**`invalid_client` on token exchange with a correct secret:**

The client's `tokenEndpointAuthMethod` does not match how it authenticates.
Set it explicitly in `OIDC_CLIENTS` to match the downstream app.

## Manual Testing

Run manual OIDC tests: `./scripts/run-manual-tests.sh http://localhost:3000`

Checklist in `scripts/manual-test-instructions.md` covers:

- Authorization code flow with PKCE
- Consent screens (skipConsent true/false)
- Token exchange and userinfo endpoint
- ID token validation
- Client seeding verification
