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
`/oauth2/userinfo` for those. The `groups` claim (for RBAC in ArgoCD, Grafana,
...) is supplied on both the ID token and UserInfo, so downstream apps keep
working wherever they read it from. Only emitted when the `groups` scope was
granted.

For every organization the user belongs to it contains, in this order
(`src/lib/oidc/groups-claim.ts`):

| Entry | Meaning | Example |
| --- | --- | --- |
| `<slug>` | member of the org, any role (the original form, unchanged) | `home` |
| `<slug>:role:<role>` | the user's org role: `owner`, `admin` or `member` | `home:role:admin` |
| `<slug>:team:<name>` | one per team the user is in, raw team name | `home:team:media` |

So a user who is an admin of `home` and in its `media` team gets
`["home", "home:role:admin", "home:team:media"]`. Map `home` for "anyone in
the org", `home:role:admin` for its admins, `home:team:media` for a team.
Note that the organization plugin creates a default team named after the org
with its creator as its first member. That does not make `home:team:home` an
owner group: an owner or admin can add anyone to that team. Map
`home:role:owner` for owner-only access.

Slugs are chosen by whoever creates an org, which is why org creation is
restricted to existing owners and admins (`docs/ORGANIZATION.md`).

## Consumers (proposed 2026-10-18)

Clients the md_cluster service PRs (#179, #180, #182, #184) need seeded. This
is a **template**: the owner pastes the entries into md_cluster's SOPS
`oidc-clients.json` (read through `OIDC_CLIENTS_FILE`), replaces `<domain>`
with the cluster domain and generates each secret. `grafana` is already seeded
and is not repeated here. Nothing below is live until that file changes.

| Client | Needs scopes | Reads `groups` for | Notes |
| --- | --- | --- | --- |
| `open-webui` | `openid email profile groups` | admin/user role mapping | Reads email/name from UserInfo |
| `immich` | `openid email profile groups` | — (optional) | Web callbacks plus the mobile `app.immich:///oauth-callback` |
| `mealie` | `openid email profile groups` | `home` user, `home:role:owner` admin | Requires `email_verified: true` (see gaps) |
| `headlamp` | `openid email profile groups` | kube RBAC via apiserver | Needs a non-EdDSA ID token (see gaps) |
| `audiobookshelf` | `openid email profile groups` | optional | Optional; callback `/auth/openid/callback` |

```json
[
  {
    "clientId": "open-webui",
    "name": "Open WebUI",
    "clientSecret": "REPLACE_ME",
    "redirectURLs": ["https://chat.<domain>/oauth/oidc/callback"],
    "tokenEndpointAuthMethod": "client_secret_post",
    "scopes": ["openid", "email", "profile", "groups"],
    "skipConsent": true
  },
  {
    "clientId": "immich",
    "name": "Immich",
    "clientSecret": "REPLACE_ME",
    "redirectURLs": [
      "https://photos.<domain>/auth/login",
      "https://photos.<domain>/user-settings",
      "app.immich:///oauth-callback"
    ],
    "tokenEndpointAuthMethod": "client_secret_post",
    "scopes": ["openid", "email", "profile", "groups"],
    "skipConsent": true
  },
  {
    "clientId": "mealie",
    "name": "Mealie",
    "clientSecret": "REPLACE_ME",
    "redirectURLs": ["https://recipes.<domain>/login"],
    "tokenEndpointAuthMethod": "client_secret_post",
    "scopes": ["openid", "email", "profile", "groups"],
    "skipConsent": true
  },
  {
    "clientId": "headlamp",
    "name": "Headlamp",
    "clientSecret": "REPLACE_ME",
    "redirectURLs": ["https://headlamp.<domain>/oidc-callback"],
    "tokenEndpointAuthMethod": "client_secret_post",
    "scopes": ["openid", "email", "profile", "groups"],
    "skipConsent": true
  },
  {
    "clientId": "audiobookshelf",
    "name": "Audiobookshelf",
    "clientSecret": "REPLACE_ME",
    "redirectURLs": [
      "https://audiobooks.<domain>/auth/openid/callback",
      "audiobookshelf://oauth"
    ],
    "tokenEndpointAuthMethod": "client_secret_post",
    "scopes": ["openid", "email", "profile", "groups"],
    "skipConsent": true
  }
]
```

`tokenEndpointAuthMethod` is a guess per app (most send the secret in the POST
body) and is enforced strictly: if a code exchange fails with `invalid_client`,
switch that entry to `client_secret_basic`. PKCE is required by default
(`OIDC_REQUIRE_PKCE`, `src/env.ts:161`); an app that does not send a
`code_challenge` needs `"requirePKCE": false` on its entry. Add
`"offline_access"` to `scopes` only for an app that wants refresh tokens.

### Known gaps found by consumers

Verified 2026-10-18 against `better-auth` / `@better-auth/oauth-provider`
1.7.5 (the pinned versions); `dist/` paths are under `node_modules/`.

**(a) ID tokens are signed with EdDSA (Ed25519).** `jwt()` is registered with
no options (`src/lib/auth.ts:260`), so the alg is
`jwks.keyPairConfig.alg ?? "EdDSA"` (`better-auth/dist/plugins/jwt/sign.mjs:54`)
and discovery advertises only `["EdDSA"]`
(`@better-auth/oauth-provider/dist/authorize-*.mjs:773-777`). Grafana accepts
it; kube-apiserver's OIDC authenticator does not (it takes RS256/ES256 and
other RSA/ECDSA algs), so Headlamp sign-in through the apiserver (md_cluster
#184) cannot work today. Immich may have the same issue (#182).

The option is `jwt({ jwks: { keyPairConfig: { alg: "RS256", modulusLength: 2048 } } })`
(or `{ alg: "ES256" }`). **Changing only that config is not a safe switch:**

- With no RS256 key in the `jwks` table, `getLatestKeyByAlg("RS256")` finds
  nothing and the resolver falls back to the newest key of any alg
  (`sign.mjs:55`), so tokens keep being signed with the old EdDSA key while
  discovery now claims RS256.
- A legacy `jwks` row with `alg` NULL is treated as "the configured alg"
  (`jwt/adapter.mjs:51-53`), so after the change an Ed25519 key would be
  imported as RS256 and signing would fail.

A real switch therefore needs a new RS256 key minted (`createJwk`, or expiring
the existing rows so the resolver mints one, `sign.mjs:57-59`) in the same
rollout. The old public key should stay in the JWKS until issued ID tokens
expire (default 10 h). Consumers that cache the JWKS (Grafana) re-fetch on an
unknown `kid`; any consumer that pins keys must be restarted.

**Recommendation:** switch to RS256 (widest support: kube-apiserver, Immich,
every other consumer), in a dedicated PR with an env-gated alg, a test that
the issued token's header and discovery agree, and a written key-rotation
step. Not changed here, since it touches every existing consumer.

**(b) `email_verified` is emitted on UserInfo only, and is usually `false`.**
The provider's standard claims include `email_verified` under the `email`
scope, resolved as `user.emailVerified ?? false`
(`oauth-provider/dist/introspect-*.mjs:160-163`). The ID token sets every
standard claim to `undefined` (`introspect-*.mjs:1260`, applied at `:1408`), so
`email`, `email_verified`, `name` are absent there. `requireEmailVerification`
is `false` (`src/lib/auth.ts:174`), so users who never clicked a verification
link (passkey/SIWE/invite sign-ups) have `emailVerified = false`. Mealie 3.21+
will refuse those users until either their `emailVerified` is set or dream-auth
asserts it. Owner decision: mark trusted users verified in the DB, or add an
opt-in claim override.

**(c) `groups` values are confirmed.** `buildGroupsClaim`
(`src/lib/oidc/groups-claim.ts:66-79`) yields `<slug>`, `<slug>:role:<role>`,
`<slug>:team:<name>`, e.g. `home`, `home:role:owner`, `home:role:admin`. It is
on both the ID token and UserInfo (`src/lib/auth.ts:287-290`) and only when the
`groups` scope is granted (`groups-claim.ts:86`).

**(d) Other findings.**

- **No `email` in the ID token** (see b). kube-apiserver reads claims only from
  the ID token, so `--oidc-username-claim=email` will not work; use
  `--oidc-username-claim=sub` (with a prefix), or add `email` to
  `customIdTokenClaims`. That hook runs after the claim guard and only
  `iss/sub/aud/exp/nbf/iat/...` are reserved (`introspect-*.mjs:13-51`,
  `:1397-1411`), so this is possible but changes every client's ID token.
- **PKCE:** S256 only (`authorize-*.mjs:725`), required per client by default.
- **Refresh tokens:** only with `offline_access` (7 days,
  `src/lib/auth.ts:272-274`) and the default `refresh_token` grant.
- **`sub` stability:** `sub` is the BetterAuth user id; no `pairwiseSecret` is
  configured, so it is the same for every client and stable for the life of
  the user row. Deleting and re-creating a user changes it.

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
