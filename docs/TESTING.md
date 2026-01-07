# Testing Strategy & Implementation

This document describes the testing infrastructure and strategy implemented for Dream Auth.

## Overview

- **Test Framework**: Vitest 3.2.4 with v8 coverage
- **React Testing**: @testing-library/react 16.x
- **Database Testing**: @testcontainers/postgresql for integration tests
- **Coverage Threshold**: 60% minimum (currently achieving 90%+)
- **Total Tests**: 200 (187 unit tests + 13 integration tests)

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Run in CI mode (verbose output + coverage)
pnpm test:ci
```

## Test Structure

```
dream-auth/
├── vitest.config.ts              # Test configuration
├── test/
│   ├── setup.ts                  # Global test setup
│   ├── setup-db.ts               # Testcontainers PostgreSQL setup
│   ├── fixtures/
│   │   └── oidc-clients.ts       # OIDC client test data
│   └── helpers/
│       └── db.ts                 # Database helper utilities
├── src/
│   ├── test/utils/
│   │   └── test-utils.tsx        # React testing utilities
│   ├── lib/
│   │   ├── utils.test.ts
│   │   ├── format.test.ts
│   │   ├── invite-helpers.test.ts
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
│       ├── api/
│       │   ├── health.test.ts
│       │   └── verify.test.ts
│       ├── oauth2/
│       │   └── $.test.ts
│       └── [.]well-known/
│           ├── openid-configuration.test.ts
│           └── jwks[.]json.test.ts
```

## Test Categories

### Unit Tests (`.test.ts` / `.test.tsx`)

Unit tests run in isolation with mocked dependencies. They use:
- **Node environment** for server-side code (`.test.ts`)
- **jsdom environment** for React hooks/components (`.test.tsx`)

### Integration Tests (`.int.test.ts`)

Integration tests require a real PostgreSQL database via testcontainers. They are automatically skipped when `DATABASE_URL` is not set (local development without Docker).

In CI, testcontainers spins up a PostgreSQL container automatically.

## Coverage Report

| Category | Files | Tests | Coverage |
|----------|-------|-------|----------|
| OIDC Schemas | `schemas.test.ts` | 25 | 100% |
| OIDC Config | `config.test.ts` | 25 | 100% |
| Utilities | `utils.test.ts` | 19 | 85.71% |
| Formatting | `format.test.ts` | 15 | 100% |
| Invite Helpers | `invite-helpers.test.ts` | 20 | 100% |
| Health API | `health.test.ts` | 3 | 100% |
| Verify API | `verify.test.ts` | 6 | 100% |
| OAuth2 Proxy | `$.test.ts` | 10 | 98% |
| OIDC Discovery | `openid-configuration.test.ts` | 8 | 100% |
| JWKS Endpoint | `jwks[.]json.test.ts` | 8 | 100% |
| Email Verification Hook | `use-email-verification.test.tsx` | 13 | 90% |
| SIWE Auth Hook | `use-siwe-auth.test.tsx` | 11 | 100% |
| SIWE Auto-Trigger Hook | `use-siwe-auto-trigger.test.tsx` | 13 | 100% |
| Org Permissions Hook | `use-org-permissions.test.tsx` | 6 | 100% |
| Sign Out Hook | `use-sign-out.test.tsx` | 5 | 100% |
| OIDC Sync (Integration) | `sync-oidc-clients.int.test.ts` | 13 | DB-dependent |

**Overall Coverage: 90.46%** (statements, lines, branches, functions)

## What's Tested

### OIDC Configuration
- Zod schema validation for all client types (web, native, public, user-agent-based)
- JSON parsing and validation of client configurations
- File loading with YAML detection and error handling
- Client merging with duplicate detection
- Production vs development error behavior

### API Endpoints
- `/api/health` - Health check response format and timestamp
- `/api/verify` - Forward auth with session headers (401/200 responses)
- `/oauth2/*` - OAuth2 proxy with JSON redirect conversion
- `/.well-known/openid-configuration` - OIDC discovery endpoint rewriting
- `/.well-known/jwks.json` - JWKS endpoint with caching headers

### React Hooks
- `useEmailVerification` - OTP sending, cooldown timer, verification flow
- `useSiweAuth` - SIWE authentication flow (nonce → sign → verify)
- `useSiweAutoTrigger` - Auto-trigger logic with loop prevention
- `useOrgPermissions` - Role-based permission derivation
- `useSignOut` - Wallet disconnect and navigation

### Utility Functions
- `isSiweGeneratedEmail()` - Wallet email pattern detection
- `getRealEmail()` - Email filtering for SIWE-generated addresses
- `formatDate()` / `formatDateLong()` - Date formatting
- `formatAddress()` - Wallet address truncation
- Invite helper functions for wallet/email invitations

## What's NOT Tested (By Design)

- **shadcn/ui components** - Already tested by the library
- **BetterAuth internals** (`auth.ts`) - Requires full integration setup
- **Nitro plugins** (`server/plugins/*`) - Require server runtime
- **Generated files** (`routeTree.gen.ts`)
- **Simple wrappers** (`use-media-query.ts`, `use-mobile.ts`)
- **Tailwind/visual styling** - Not behavioral

## CI/CD Integration

Tests run automatically on every PR via GitHub Actions:

```yaml
# .github/workflows/ci.yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:ci
```

The build job depends on tests passing.

## Writing New Tests

### Unit Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies BEFORE imports
vi.mock("@/lib/some-module", () => ({
  someFunction: vi.fn(),
}));

import { functionToTest } from "./module-under-test";
import { someFunction } from "@/lib/some-module";

describe("functionToTest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does something", () => {
    vi.mocked(someFunction).mockReturnValue("mocked");
    const result = functionToTest();
    expect(result).toBe("expected");
  });
});
```

### React Hook Test Template

```tsx
/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: { someMethod: vi.fn() },
}));

import { useMyHook } from "./use-my-hook";

describe("useMyHook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns expected state", async () => {
    const { result } = renderHook(() => useMyHook());

    await act(async () => {
      await result.current.someAction();
    });

    expect(result.current.value).toBe("expected");
  });
});
```

### Integration Test Template

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";

describe("Database Integration", () => {
  let pool: Pool;
  const skipIfNoDb = !process.env.DATABASE_URL;

  beforeEach(async () => {
    if (skipIfNoDb) return;
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // Setup...
  });

  afterEach(async () => {
    if (skipIfNoDb) return;
    await pool?.end();
  });

  it.skipIf(skipIfNoDb)("interacts with database", async () => {
    // Test with real database
  });
});
```

## Troubleshooting

### Tests timeout
Increase timeout in `vitest.config.ts`:
```typescript
testTimeout: 60000, // 60 seconds
```

### Integration tests skipped locally
Set `DATABASE_URL` or run PostgreSQL via Docker:
```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=test postgres:16
export DATABASE_URL="postgresql://postgres:test@localhost:5432/postgres"
pnpm test
```

### Coverage below threshold
Check which files are included/excluded in `vitest.config.ts` coverage settings.

---

*Last updated: January 2025*
