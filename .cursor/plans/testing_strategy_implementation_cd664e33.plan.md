---
name: Testing Strategy Implementation
overview: Implement a comprehensive testing strategy covering unit tests for pure functions and schemas, integration tests for OIDC/auth flows and API endpoints, and component tests for React hooks. Focus on high-value tests that catch breaking changes while avoiding trivial coverage.
todos:
  - id: vitest-setup
    content: Create vitest.config.ts with env matching + test helpers (env, postgres, server)
    status: in_progress
  - id: oidc-unit-tests
    content: Write unit tests for OIDC schemas, config parsing, and route rewrites
    status: pending
    dependencies:
      - vitest-setup
  - id: utility-tests
    content: Write unit tests for utils.ts, format.ts, invite-helpers.ts
    status: pending
    dependencies:
      - vitest-setup
  - id: hook-tests
    content: Write tests for React hooks (email-verification, siwe-auth, siwe-auto-trigger, org-permissions, sign-out)
    status: pending
    dependencies:
      - vitest-setup
  - id: api-route-tests
    content: Write tests for API route handlers and OIDC discovery endpoints
    status: pending
    dependencies:
      - vitest-setup
  - id: db-integration-tests
    content: Write Testcontainers-based integration tests for OIDC seeding and invitation queries
    status: pending
    dependencies:
      - vitest-setup
  - id: smoke-tests
    content: Write HTTP smoke tests that spawn actual server and test OIDC endpoints
    status: pending
    dependencies:
      - db-integration-tests
---

# Testing Strategy for Dream Auth

## Testing Architecture Overview

```mermaid
flowchart TB
    subgraph unit [Unit Tests - Fast, No IO]
        schemas[Zod Schemas]
        utils[Pure Utilities]
        oidcConfig[OIDC Config Parsing]
        routeRewrites[Route Rewrite Logic]
    end
    
    subgraph jsdom [Component/Hook Tests - jsdom]
        hooks[React Hooks]
        authGating[Auth Gating]
    end
    
    subgraph integration [Integration Tests - Testcontainers Postgres]
        oidcSync[OIDC Client Seeding]
        inviteQuery[Invitation Preview Query]
    end
    
    subgraph smoke [HTTP Smoke Tests - Real Server]
        healthEndpoint["/api/health"]
        oidcDiscovery["/.well-known/openid-configuration"]
        jwksEndpoint["/.well-known/jwks.json"]
        oauthAuthorize["/oauth2/authorize"]
    end
    
    unit --> jsdom
    jsdom --> integration
    integration --> smoke
```



## Goals and Non-Goals

**Goals:**

- Catch real regressions in auth/OIDC, Postgres-backed business rules, and wallet/email flows
- Keep tests deterministic
- Maximize coverage-per-test

**Non-Goals:**

- Testing shadcn/ui primitives, Tailwind classes, icon rendering
- Snapshotting whole pages
- Testing pure passthrough functions (e.g., `cn()`)

---

## 1. Test Infrastructure Setup

### Vitest Configuration

Create [`vitest.config.ts`](vitest.config.ts) with environment matching:

```typescript
import { defineConfig } from 'vitest/config'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [viteTsConfigPaths()],
  test: {
    globals: true,
    environmentMatchGlobs: [
      // Hook and component tests use jsdom
      ['**/*.test.tsx', 'jsdom'],
      ['**/*.dom.test.ts', 'jsdom'],
      // Server/integration tests use node
      ['**/*.server.test.ts', 'node'],
      ['**/*.int.test.ts', 'node'],
      // Default to node for unit tests
      ['**/*.test.ts', 'node'],
    ],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      exclude: [
        'src/routeTree.gen.ts',
        'src/components/ui/**',
        '**/*.d.ts',
        '**/node_modules/**',
      ],
      thresholds: {
        // Start moderate, raise gradually
        lines: 50,
        functions: 50,
        branches: 50,
      },
    },
  },
})
```



### Test Helpers Structure

```javascript
src/test/
├── setup.ts                    # Global test setup and mocks
├── helpers/
│   ├── env.ts                  # Consistent env baseline for serverEnv imports
│   ├── postgres.ts             # Testcontainers Postgres start/stop + DATABASE_URL
│   └── server.ts               # Spawn app for smoke tests, wait for /api/health
└── utils/
    └── test-utils.tsx          # Custom render with providers (QueryClient, Router)
```



### New Dependencies to Add

```bash
pnpm add -D @vitest/coverage-v8 testcontainers @testcontainers/postgresql
```

---

## 2. Unit Tests (Highest Priority, node environment)

### Pure Utility Functions

**[`src/lib/utils.test.ts`](src/lib/utils.test.ts)**

- `isSiweGeneratedEmail()` - test pattern matching for wallet-generated emails
- `getRealEmail()` - test null handling and SIWE email detection

**[`src/lib/format.test.ts`](src/lib/format.test.ts)**

- `formatDate()` / `formatDateLong()` - test date formatting
- `formatAddress()` - test wallet address truncation and null handling

**[`src/lib/invite-helpers.test.ts`](src/lib/invite-helpers.test.ts)**

- `getWalletEmail()` - test deterministic email generation
- `isWalletInvitation()` / `getInvitationWalletAddress()` - test invitation type detection

### OIDC Schemas and Validation

**[`src/lib/oidc/schemas.test.ts`](src/lib/oidc/schemas.test.ts)**

- Test `oidcClientSchema` validation for all valid client types (web, native, user-agent-based, public)
- Test refinement: `clientSecret` required for non-public clients
- Edge cases: missing redirectURLs, invalid URLs, empty clientId

**[`src/lib/oidc/config.test.ts`](src/lib/oidc/config.test.ts)**

- `parseOidcClientsJson()` - JSON parsing, validation errors, malformed input
- `loadOidcClientsFromFile()` - mock fs, file not found, YAML detection fail-fast in production
- `mergeOidcClients()` - duplicate detection, throw in production mode

### OIDC Route Rewrite Logic (Unit with mocked auth.handler)

**[`src/routes/oauth2/$.test.ts`](src/routes/oauth2/$.test.ts)**

- Test OAuth2 proxy converts BetterAuth JSON redirect payload into HTTP 302
- Test query params are preserved during proxy

**[`src/routes/[.]well-known/openid-configuration.test.ts`](src/routes/[.]well-known/openid-configuration.test.ts)**

- Test rewrites issuer to root URL
- Test rewrites all endpoints (authorization, token, userinfo, jwks_uri, end_session)
- Test Cache-Control header is set

**[`src/routes/[.]well-known/jwks[.]json.test.ts`](src/routes/[.]well-known/jwks[.]json.test.ts)**

- Test adds Cache-Control header on GET
- Test HEAD request returns proper headers without body

---

## 3. React Hook Tests (jsdom environment)

Use `@testing-library/react` with `renderHook`:**[`src/hooks/use-email-verification.test.tsx`](src/hooks/use-email-verification.test.tsx)** (Complex logic)

- Test OTP cooldown timer behavior (30 second cooldown)
- Test sendOtp success/error states
- Test verifyOtp success/error states and router.invalidate call
- Test reset functionality
- Test isNewEmail flow (calls changeEmail first)

**[`src/hooks/use-siwe-auth.test.tsx`](src/hooks/use-siwe-auth.test.tsx)**

- Test authenticate flow (nonce -> sign -> verify)
- Test error handling and wallet disconnect
- Test clearError functionality

**[`src/hooks/use-siwe-auto-trigger.test.tsx`](src/hooks/use-siwe-auto-trigger.test.tsx)** (Loop prevention)

- Test triggers once per address
- Test resets tracking on disconnect
- Test respects modal state and isAuthenticating
- Test 300ms delay for modal close animation

**[`src/hooks/use-org-permissions.test.tsx`](src/hooks/use-org-permissions.test.tsx)**

- Test permission derivation (isOwner, isAdmin, isOwnerOrAdmin, isMember)
- Test when no active org or no membership

**[`src/hooks/use-sign-out.test.tsx`](src/hooks/use-sign-out.test.tsx)**

- Test disconnects wallet, signs out, and navigates to /login

### Auth Gating Tests

**[`src/routes/_authed.test.tsx`](src/routes/_authed.test.tsx)**

- Test beforeLoad redirects to /login when context.session is missing
- Test passes session to child routes when authenticated

---

## 4. Integration Tests (Testcontainers Postgres)

### OIDC Client Seeding

**[`src/lib/oidc/sync-oidc-clients.int.test.ts`](src/lib/oidc/sync-oidc-clients.int.test.ts)**

- Test inserts expected columns into "oauthApplication"
- Test ON CONFLICT ("clientId") updates fields without duplicating
- Test duplicate config clientIds rejected
- Test singleton promise prevents multiple seedings
- Test `_resetSeedingState()` for test isolation

### Invitation Preview Query

**Refactor suggestion:** Extract the invitation preview query from [`src/routes/invite.$id.tsx`](src/routes/invite.$id.tsx) into [`src/lib/invitations.server.ts`](src/lib/invitations.server.ts) so integration tests can call it directly without TanStack Start runtime.**[`src/lib/invitations.server.int.test.ts`](src/lib/invitations.server.int.test.ts)**

- Test returns masked wallet preview and never returns email/inviter
- Test handles missing ID => null
- Test returns correct organization name and role

---

## 5. HTTP Smoke Tests (Real Server, Black-Box)

Spawn the app server once for the suite (with Testcontainers Postgres + env flags), then fetch endpoints.**[`tests/smoke/endpoints.smoke.test.ts`](tests/smoke/endpoints.smoke.test.ts)**| Endpoint | Assertion ||----------|-----------|| `GET /api/health` | Returns 200 with `{ status: "ok" }` || `GET /.well-known/openid-configuration` | Issuer matches root URL, endpoints rewritten || `GET /.well-known/jwks.json` | Returns keys array, has Cache-Control header || `HEAD /.well-known/jwks.json` | Returns 200 with Cache-Control, no body || `GET /oauth2/authorize` (unauthenticated) | Redirects to /login or returns predictable status |---

## 6. Recommended Testability Refactors (High ROI)

These small changes dramatically improve test quality and reduce brittle mocking:

1. **Extract invitation preview query** from [`src/routes/invite.$id.tsx`](src/routes/invite.$id.tsx) into [`src/lib/invitations.server.ts`](src/lib/invitations.server.ts) so integration tests can call it directly.
2. **Extract BetterAuth hook logic** from [`src/lib/auth.ts`](src/lib/auth.ts) into pure helpers (e.g., `src/lib/auth-hooks.server.ts`) to unit-test:

                - Registration blocking when `ENABLE_REGISTRATION=false` (invitation exception)
                - Wallet invitation verification logic (SIWE-linked account check)

3. **Export migration helpers** from [`server/plugins/better-auth-auto-migrate.ts`](server/plugins/better-auth-auto-migrate.ts) so we can unit-test the advisory-lock timeout loop with fake timers.

---

## 7. What NOT to Test (Avoid Trivial Tests)

- **shadcn/ui components** - Already tested by the library
- **Tailwind classes, icon rendering** - Visual, not behavioral
- **Simple type exports** - No logic to test
- **Environment validation** - T3-env handles validation
- **Pure passthrough functions** - Like `cn()` which just wraps clsx/tailwind-merge
- **Generated files** - `src/routeTree.gen.ts`

---

## Complete File Structure

```javascript
dream-auth/
├── vitest.config.ts
├── src/
│   ├── test/
│   │   ├── setup.ts
│   │   ├── helpers/
│   │   │   ├── env.ts
│   │   │   ├── postgres.ts
│   │   │   └── server.ts
│   │   └── utils/
│   │       └── test-utils.tsx
│   ├── lib/
│   │   ├── utils.test.ts
│   │   ├── format.test.ts
│   │   ├── invite-helpers.test.ts
│   │   ├── invitations.server.ts        # NEW: Extracted query
│   │   ├── invitations.server.int.test.ts
│   │   ├── auth-hooks.server.ts         # NEW: Extracted hooks
│   │   └── oidc/
│   │       ├── schemas.test.ts
│   │       ├── config.test.ts
│   │       └── sync-oidc-clients.int.test.ts
│   ├── hooks/
│   │   ├── use-email-verification.test.tsx
│   │   ├── use-siwe-auth.test.tsx
│   │   ├── use-siwe-auto-trigger.test.tsx
│   │   ├── use-org-permissions.test.tsx
│   │   └── use-sign-out.test.tsx
│   └── routes/
│       ├── _authed.test.tsx
│       ├── oauth2/
│       │   └── $.test.ts
│       ├── [.]well-known/
│       │   ├── openid-configuration.test.ts
│       │   └── jwks[.]json.test.ts
│       └── api/
│           ├── health.test.ts
│           └── verify.test.ts
└── tests/
    └── smoke/
        └── endpoints.smoke.test.ts
```

---

## Test Commands

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:smoke": "vitest run tests/smoke/"
  }
}
```

---

## Dependencies Summary

**Already installed:**

- `vitest` (^3.0.5)
- `@testing-library/react` (^16.2.0)
- `@testing-library/dom` (^10.4.0)
- `jsdom` (^27.0.0)

**Need to add:**

- `@vitest/coverage-v8` - Coverage reporting
- `testcontainers` - Docker-based test containers
- `@testcontainers/postgresql` - Postgres test container

---

## Priority Order for Implementation

1. **Vitest config + test helpers** - Foundation for all tests
2. **OIDC schemas, config, and route rewrite tests** - Critical for SSO functionality
3. **Utility function tests** - Quick wins, high confidence
4. **Hook tests** - Complex business logic lives here (especially siwe-auto-trigger)
5. **Auth gating tests** - Ensure protected routes work
6. **DB integration tests with Testcontainers** - Real Postgres for seeding/invitations
7. **HTTP smoke tests** - End-to-end confidence for OIDC endpoints

---

## CI Recommendation

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
                                    - uses: actions/checkout@v4
                                    - uses: pnpm/action-setup@v2
                                    - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
                                    - run: pnpm install
                                    - run: pnpm test:coverage
                                    - run: pnpm test:smoke
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test



```