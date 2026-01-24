# OIDC Provider Implementation

## Core Issue

BetterAuth validates OIDC clients via `trustedClients` config (in-memory) but doesn't seed them to the `oauthApplication` table. This causes FK constraint violations during token exchange ([Better Auth #6649](https://github.com/better-auth/better-auth/issues/6649)).

## Solution Architecture

### 1. Configuration Loading (`src/lib/oidc/config.ts`)

- Loads clients from `OIDC_CLIENTS` env var (JSON array)
- Loads clients from `OIDC_CLIENTS_FILE` (for Kubernetes ConfigMaps)
- Validates with Zod schema (`src/lib/oidc/schemas.ts`)
- Merges both sources and checks for duplicate client IDs
- Fail-fast in production on errors

### 2. Database Seeding (`src/lib/oidc/sync-oidc-clients.ts`)

- Automatically seeds clients to `oauthApplication` table on startup
- Uses `INSERT...ON CONFLICT DO UPDATE` for idempotency
- Non-blocking background operation (see `src/lib/auth.ts:228-239`)
- Validates clients before DB insertion (redirectURLs, clientSecret, etc.)
- Singleton promise ensures seeding only runs once per process

### 3. Environment Configuration (`src/env.ts`)

- `serverEnvWithOidc.OIDC_CLIENTS` provides merged, validated clients
- Lazy-loaded and cached after first access
- Logs loaded client IDs (never secrets)

### 4. BetterAuth Integration (`src/lib/auth.ts:113-133`)

- `trustedClients` transforms config to BetterAuth format
- Enables skipConsent UX and in-memory validation
- Database seeding ensures FK integrity for token operations

## Troubleshooting

**Token exchange fails with FK error:**
1. Ensure `ENABLE_OIDC_PROVIDER=true` is set
2. Check logs for "Seeding N client(s) to database" on startup
3. Verify `oauthApplication` table has your client (query DB)

## Manual Testing

Run manual OIDC tests: `./scripts/run-manual-tests.sh http://localhost:3000`

Checklist in `scripts/manual-test-instructions.md` covers:
- Authorization code flow with PKCE
- Consent screens (skipConsent true/false)
- Token exchange and userinfo endpoint
- ID token validation
- Client seeding verification
