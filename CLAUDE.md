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

### Running Tests

```bash
# Unit tests (Vitest)
pnpm test                    # Run all unit tests
pnpm test:coverage           # Run with coverage report

# Integration tests (Testcontainers)
pnpm test:integration        # Run integration tests with real PostgreSQL

# E2E tests (Playwright)
pnpm test:e2e                # Run all E2E tests
pnpm test:e2e:ui             # Interactive UI mode
pnpm test:e2e:debug          # Debug mode with inspector
pnpm test:e2e:report         # View HTML test report

# All tests
pnpm test:all                # Unit + Integration + E2E
pnpm typecheck               # Ensure type safety (run before committing)
```

### E2E Testing Architecture

**Location:** `e2e/` directory

The E2E test suite uses Playwright with Testcontainers for database isolation:

```text
e2e/
├── fixtures/                 # Playwright fixtures
│   ├── auth-fixtures.ts     # Authentication helpers
│   ├── database-fixtures.ts # Database access and cleanup
│   └── index.ts             # Combined fixtures export
├── helpers/
│   ├── assertions.ts        # Custom assertions
│   ├── navigation.ts        # Navigation utilities (registerUser, loginUser)
│   └── test-user-factory.ts # Test data creation
├── tests/
│   ├── auth/                # Authentication flow tests
│   ├── health/              # Health check tests
│   ├── oidc/                # OIDC provider tests
│   └── protected-routes/    # Route protection tests
├── test-config.ts           # Single source of truth for E2E environment config
├── global-setup.ts          # Starts PostgreSQL container and loads config
├── global-teardown.ts       # Cleanup
└── playwright.config.ts     # Playwright configuration
```

**Key Concepts:**

1. **Configuration Management:** `test-config.ts` provides centralized E2E environment configuration with sensible defaults. Environment variables can override these defaults (e.g., in GitHub Actions).
2. **Global Setup/Teardown:** Starts PostgreSQL via Testcontainers, loads config, injects into `process.env` for webServer inheritance
3. **webServer Config:** Playwright manages the dev server lifecycle automatically with full environment
4. **Label-Based Selectors:** Use `page.getByLabel()` and `page.getByRole()` for robust element selection
5. **Transaction Isolation:** Database fixtures provide transaction-based test isolation

**Writing E2E Tests:**

```typescript
import { test, expect } from "../../fixtures";
import { registerUser } from "../../helpers/navigation";

test.describe("Feature Name", () => {
  test("should do something", async ({ page }) => {
    await registerUser(page, "Test User", "test@example.com", "Password123!");
    await expect(page).toHaveURL("/");
  });
});
```

**CI Integration:** `.github/workflows/e2e.yml` runs E2E tests with artifact upload for reports.

See [docs/E2E-TESTING.md](./docs/E2E-TESTING.md) for comprehensive documentation.

### Manual OIDC Tests

Run manual OIDC tests: `./scripts/run-manual-tests.sh http://localhost:3000`

Checklist in `scripts/manual-test-instructions.md` covers:

- Authorization code flow with PKCE
- Consent screens (skipConsent true/false)
- Token exchange and userinfo endpoint
- ID token validation
- Client seeding verification

### Test File Structure

- **Unit tests:** Co-located with source files (e.g., `use-siwe-auth.test.tsx` next to `use-siwe-auth.ts`)
- **Mock factories:** `test/mocks/` directory with path alias `@test/mocks/*`
- **Test utilities:** Use Vitest's built-in utilities, avoid custom test helpers

### Type-Safe Mocking Principles

**Never use type casting (`as`) or `@ts-expect-error` to silence type errors in tests.** Instead, fix the underlying type issue:

1. **Create typed mock factories** that return properly typed objects
2. **Use `Extract<>` for discriminated unions** to get specific union members
3. **Use `vi.hoisted()` when mocks need to be referenced in `vi.mock()` factories**
4. **Export handlers separately** from route definitions for direct testing

### Mock Factory Pattern

Mock factories live in `test/mocks/` and produce fully-typed objects:

```typescript
// test/mocks/wagmi.ts
import type { UseConnectionReturnType } from "wagmi";

// Use Extract to get specific union member from discriminated union
type ConnectedAccountState = Extract<UseConnectionReturnType, { status: "connected" }>;

export function createConnectedAccount(
  overrides: { address?: `0x${string}`; chainId?: number } = {}
): ConnectedAccountState {
  return {
    address: overrides.address ?? "0x1234...",
    addresses: [overrides.address ?? "0x1234..."],
    chainId: overrides.chainId ?? 1,
    // ... all required properties with correct types
    status: "connected",
    isConnected: true,
  };
}
```

### vi.hoisted() Pattern

When mocks need to be accessed inside `vi.mock()` factory functions, use `vi.hoisted()` to avoid "Cannot access before initialization" errors:

```typescript
// vi.mock() calls are hoisted to top of file BEFORE variable declarations
// vi.hoisted() runs the callback at hoist time, making variables available

const { mockUseSession, mockUseActiveOrganization } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockUseActiveOrganization: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useActiveOrganization: mockUseActiveOrganization },
  useSession: mockUseSession,
}));

// Now in tests, use mock factories with the hoisted mocks:
import { createUseSessionReturn, createMockSession } from "@test/mocks/auth-client";

beforeEach(() => {
  mockUseSession.mockReturnValue(
    createUseSessionReturn(createMockSession({ user: { id: "user-1" } }))
  );
});
```

### Extract<> for Discriminated Unions

Wagmi and other libraries use discriminated unions where the type depends on a `status` field. Use `Extract<>` to get specific members:

```typescript
import type { UseConnectionReturnType, UseSignMessageReturnType } from "wagmi";

// Get the "connected" variant of the union
type ConnectedState = Extract<UseConnectionReturnType, { status: "connected" }>;

// Get the "idle" variant for mutation hooks
type IdleSignMessageState = Extract<UseSignMessageReturnType, { status: "idle" }>;
```

### Route Handler Testing

Route handlers are exported separately from route definitions for direct testing without mocking TanStack Router:

```typescript
// src/routes/api/verify.ts
import type { ServerRouteHandler } from "@/lib/server-handler";

// Export handler directly - testable without route framework
export const GET: ServerRouteHandler = async ({ request }) => {
  // ... implementation
};

// Route uses the exported handler
export const Route = createFileRoute("/api/verify")({
  server: { handlers: { GET } },
});
```

```typescript
// src/routes/api/verify.test.ts
import { GET } from "./verify";

it("returns 200 with valid session", async () => {
  const request = new Request("http://localhost/api/verify");
  const response = await GET({ request, params: {} });
  expect(response.status).toBe(200);
});
```

### Available Mock Factories

| Factory | Location | Purpose |
|---------|----------|---------|
| `createConnectedAccount()` | `@test/mocks/wagmi` | Wagmi useAccount in connected state |
| `createDisconnectedAccount()` | `@test/mocks/wagmi` | Wagmi useAccount in disconnected state |
| `createSignMessage()` | `@test/mocks/wagmi` | Wagmi useSignMessage hook |
| `createDisconnect()` | `@test/mocks/wagmi` | Wagmi useDisconnect hook |
| `createMockSession()` | `@test/mocks/auth-client` | BetterAuth session with user |
| `createUseSessionReturn()` | `@test/mocks/auth-client` | useSession() return value |
| `createMockOrganization()` | `@test/mocks/auth-client` | Organization with members/invitations |
| `createUseActiveOrganizationReturn()` | `@test/mocks/auth-client` | useActiveOrganization() return value |
| `createOrgMembersOptions()` | `@test/mocks/org-query` | TanStack Query options for org members |
| `createMockOrgMember()` | `@test/mocks/org-query` | Organization member object |

### JSDOM Environment for React Hooks

React hook tests require the jsdom environment. Add the directive at the top of the file:

```typescript
/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
// ...
```

### Common Testing Mistakes to Avoid

1. **Type casting mock return values:**
   ```typescript
   // BAD: Hides missing required properties
   vi.mocked(useAccount).mockReturnValue({ address: "0x..." } as ReturnType<typeof useAccount>);

   // GOOD: Use typed factory that includes all required properties
   vi.mocked(useAccount).mockReturnValue(createConnectedAccount());
   ```

2. **Ignoring type errors with directives:**
   ```typescript
   // BAD: Sweeps type issues under the rug
   // @ts-expect-error
   const result = someFunction();

   // GOOD: Fix the underlying type issue
   const result = someFunction(); // Types align properly
   ```

3. **Mocking entire modules when only one export is needed:**
   ```typescript
   // BAD: Brittle, requires updating mock when module changes
   vi.mock("wagmi", () => ({ useAccount: vi.fn(), useDisconnect: vi.fn(), ... }));

   // GOOD: Only mock what you need, let rest pass through (when possible)
   vi.mock("wagmi", async (importOriginal) => ({
     ...(await importOriginal()),
     useAccount: vi.fn(),
   }));
   ```

4. **Not using vi.hoisted() for mock references:**
   ```typescript
   // BAD: "Cannot access before initialization" error
   const mockFn = vi.fn();
   vi.mock("./module", () => ({ fn: mockFn }));

   // GOOD: vi.hoisted() runs at hoist time
   const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }));
   vi.mock("./module", () => ({ fn: mockFn }));
   ```

## Docker Deployment

Multi-stage build (see `Dockerfile`):

- **Builder stage:** Node 22 Alpine with pnpm
- **Runner stage:** Node 22 Alpine (not Bun - ESM compatibility)
- **Non-root user:** UID/GID 1001
- **Health check:** `/api/health` endpoint

Run locally: `docker-compose up -d` (includes PostgreSQL)
