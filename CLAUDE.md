# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dream Auth is a self-hosted identity provider built on TanStack Start with BetterAuth. It provides passkeys (WebAuthn), Sign-In With Ethereum (SIWE), and traditional email/password authentication while acting as an OIDC provider for SSO with Kubernetes applications.

## Development Commands

```bash
# Development
pnpm dev                              # Start dev server on port 3000
pnpm build                            # Build for production
pnpm start                            # Start production server (requires .output/ from build)

# Code Quality
pnpm lint                             # Run Biome linter
pnpm format                           # Format code with Biome
pnpm check                            # Run all Biome checks
pnpm typecheck                        # Run TypeScript type checking

# Database Migrations
pnpm dlx @better-auth/cli generate    # Generate migration SQL (review changes)
pnpm dlx @better-auth/cli migrate     # Apply migrations to database

# Testing
pnpm test                             # Run Vitest tests

# UI Components
pnpm dlx shadcn@latest add <component>  # Add shadcn/ui component
```

## Critical Architecture

### Authentication System (BetterAuth)

**Location:** `src/lib/auth.ts`

This is the central authentication configuration. Key aspects:

- **Database:** Uses PostgreSQL connection pool directly via `pg` (not Kysely ORM)
- **Plugins:** Order matters! `jwt()` must come before `oidcProvider()` for OIDC to work
- **OIDC Client Seeding:** `ensureOidcClientsSeeded()` is called at module load to seed clients from config into DB (see OIDC section below)
- **Account Linking:** Enabled to allow users to link wallets/passkeys to existing email accounts
- **Cookie Caching:** Currently disabled due to TanStack Start SSR context issues (see comments in auth.ts)
- **Disabled Paths:** When OIDC is enabled, `/token` endpoint is disabled (OIDC uses `/oauth2/token`)

### OIDC Provider Implementation

**Core Issue:** BetterAuth validates OIDC clients via `trustedClients` config (in-memory) but doesn't seed them to the `oauthApplication` table. This causes FK constraint violations during token exchange ([Better Auth #6649](https://github.com/better-auth/better-auth/issues/6649)).

**Solution Architecture:**

1. **Configuration Loading** (`src/lib/oidc/config.ts`):

   - Loads clients from `OIDC_CLIENTS` env var (JSON array)
   - Loads clients from `OIDC_CLIENTS_FILE` (for Kubernetes ConfigMaps)
   - Validates with Zod schema (`src/lib/oidc/schemas.ts`)
   - Merges both sources and checks for duplicate client IDs
   - Fail-fast in production on errors

2. **Database Seeding** (`src/lib/oidc/sync-oidc-clients.ts`):

   - Automatically seeds clients to `oauthApplication` table on startup
   - Uses `INSERT...ON CONFLICT DO UPDATE` for idempotency
   - Non-blocking background operation (see `src/lib/auth.ts:228-239`)
   - Validates clients before DB insertion (redirectURLs, clientSecret, etc.)
   - Singleton promise ensures seeding only runs once per process

3. **Environment Configuration** (`src/env.ts`):

   - `serverEnvWithOidc.OIDC_CLIENTS` provides merged, validated clients
   - Lazy-loaded and cached after first access
   - Logs loaded client IDs (never secrets)

4. **BetterAuth Integration** (`src/lib/auth.ts:113-133`):
   - `trustedClients` transforms config to BetterAuth format
   - Enables skipConsent UX and in-memory validation
   - Database seeding ensures FK integrity for token operations

**Testing:** See `scripts/manual-test-instructions.md` for OIDC flow tests

### Auto-Migrations System

**Location:** `server/plugins/better-auth-auto-migrate.ts` (Nitro startup plugin)

Safe for Kubernetes multi-replica deployments:

- **PostgreSQL Advisory Lock:** Uses `pg_try_advisory_lock(hashtext($1))` to ensure only one pod runs migrations at a time
- **Double-Check Pattern:** Checks for pending migrations before acquiring lock (avoids contention when up-to-date), then re-checks after acquiring lock (in case another pod ran them)
- **Additive-Only:** Better Auth never drops columns/tables
- **Detailed Logging:** Shows exactly what tables/columns will be created (GitOps audit trail)
- **Configurable:**
  - `BETTER_AUTH_AUTO_MIGRATE=true` to enable
  - `BETTER_AUTH_MIGRATION_LOCK_KEY` for multiple deployments on same DB
  - `BETTER_AUTH_MIGRATION_LOCK_TIMEOUT_MS` (default 10 minutes)

**Important:** Nitro plugin must be included in `vite.config.ts` plugins array:

```ts
nitro({
  preset: 'node-server',
  plugins: ['server/plugins/better-auth-auto-migrate.ts'],
}),
```

### TanStack Start Routing

File-based routing: Routes in `src/routes/` map to URLs

**Key route patterns:**

- `_authed.tsx` - Layout route requiring authentication (child routes under `_authed/`)
- `__root.tsx` - Root layout with `<Outlet />` for all routes, loads session in `beforeLoad`
- `api/auth/$.ts` - Catch-all route for BetterAuth API (`/api/auth/*`)
- `oauth2/$.ts` - Catch-all for OIDC provider endpoints (`/oauth2/*`)
- `[.]well-known/` - OIDC discovery and JWKS endpoints (special syntax for dots in filenames)

**Session Loading:** `src/lib/session.server.ts` provides `createServerFn()` helper:

```ts
export const getSessionFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const headers = getRequestHeaders();
    return auth.api.getSession({ headers });
  }
);
```

### Environment Variables (T3Env)

Split configuration for security:

**Server-only** (`src/env.ts`):

- Uses `process.env` (Node.js)
- Database credentials, secrets, OIDC clients
- Export `serverEnv` for basic vars, `serverEnvWithOidc` for OIDC-aware code

**Client-safe** (`src/env.client.ts`):

- Uses `import.meta.env` (Vite)
- Only `VITE_*` prefixed variables
- Can be imported in browser code

**Never import `src/env.ts` in client code - it will bundle secrets into the browser bundle!**

### Wagmi/Viem Integration (SIWE)

**Configuration:** `src/lib/wagmi.ts` defines chains and WalletConnect config

**Custom SimpleKit:** `src/components/simplekit/` - Lightweight wallet connection UI built on Wagmi

- Avoids external dependencies (RainbowKit, ConnectKit)
- Supports WalletConnect v2 for mobile wallets (if `VITE_WALLETCONNECT_PROJECT_ID` is set)
- Integrates with BetterAuth's SIWE flow

**SIWE Flow in BetterAuth** (`src/lib/auth.ts:148-201`):

- Generate nonce with `generateSiweNonce()` from `viem/siwe`
- Verify signature with `verifyMessage()` from `viem`
- Optional ENS lookup for name/avatar via `createPublicClient()`

### Forward Auth for Kubernetes

**Endpoint:** `/api/verify` (`src/routes/api/verify.ts`)

Returns `200` with session headers or `401` redirect. Used with nginx ingress:

```yaml
annotations:
  nginx.ingress.kubernetes.io/auth-url: "http://dream-auth.auth.svc:3000/api/verify"
  nginx.ingress.kubernetes.io/auth-signin: "https://auth.example.com/login?rd=$escaped_request_uri"
  nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-User,X-Auth-Id,X-Auth-Email"
```

## Coding Conventions

### Database Schema

BetterAuth uses **camelCase** column names via Kysely adapter (not snake_case). Example:

- Table: `"oauthApplication"`
- Columns: `"clientId"`, `"clientSecret"`, `"redirectUrls"`, `"createdAt"`

When writing raw SQL queries, always quote identifiers and use camelCase.

### Styling

- Tailwind CSS v4 with Vite plugin (not PostCSS)
- shadcn/ui components in `src/components/ui/`
- Add new components: `pnpm dlx shadcn@latest add <component>`
- Biome formatting: tabs, double quotes

### Error Handling

- **Console logging:** Use structured logs with `[Context]` prefix (e.g., `[OIDC]`, `[BetterAuth]`)
- **Never log secrets:** Only log client IDs, not secrets/tokens
- **Production fail-fast:** Throw errors in production for invalid config (see OIDC validation)

### Database Access

**Prefer Better Auth API methods over direct database queries.** Use `auth.api.*` endpoints for type-safe data access when available. Direct `pool.query()` should only be used when:

1. Better Auth doesn't expose the needed endpoint
2. The endpoint requires authentication but you need unauthenticated access (e.g., pre-auth invitation preview)
3. You need a custom query not supported by Better Auth

See [Better Auth Organization Plugin Docs](https://www.better-auth.com/docs/plugins/organization) for available API methods.

Other plugin docs also available, they each add different methods, use context7 mcp to find. Type signature of the auth.api object will also show you available methods.

## Common Pitfalls

### OIDC Token Exchange Fails with FK Error

- Ensure `ENABLE_OIDC_PROVIDER=true` is set
- Check logs for "Seeding N client(s) to database" on startup
- Verify `oauthApplication` table has your client (query DB)

### Session Not Loading in SSR

- Use `createServerFn()` from `src/lib/session.server.ts`
- Don't call BetterAuth API endpoints directly in loaders
- TanStack Start's SSR context is different from request context

### Environment Variables Not Working

- Server vars: `src/env.ts` → `serverEnv` or `serverEnvWithOidc`
- Client vars: `src/env.client.ts` → `clientEnv`
- Client vars need `VITE_` prefix
- Set `SKIP_ENV_VALIDATION=true` for Docker builds

### Migration Failures

- Always review generated SQL before applying: `pnpm dlx @better-auth/cli generate`
- Check PostgreSQL advisory lock if timeout occurs
- Ensure only one migration runs at a time (advisory lock handles this)

### Build Errors in Docker

- Set `SKIP_ENV_VALIDATION=true` in Dockerfile
- Ensure `node-server` preset in `vite.config.ts` for Nitro
- Include Nitro plugins in config (auto-migrate)

## Testing

Run manual OIDC tests: `./scripts/run-manual-tests.sh http://localhost:3000`

Checklist in `scripts/manual-test-instructions.md` covers:

- Authorization code flow with PKCE
- Consent screens (skipConsent true/false)
- Token exchange and userinfo endpoint
- ID token validation
- Client seeding verification

## Docker Deployment

Multi-stage build (see `Dockerfile`):

- **Builder stage:** Node 22 Alpine with pnpm
- **Runner stage:** Node 22 Alpine (not Bun - ESM compatibility)
- **Non-root user:** UID/GID 1001
- **Health check:** `/api/health` endpoint

Run locally: `docker-compose up -d` (includes PostgreSQL)
