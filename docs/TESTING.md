# Testing Guide

## Running Tests

```bash
# Unit tests (Vitest)
pnpm test                    # Run all unit tests
pnpm test:coverage           # Run with coverage report
pnpm test:watch              # Watch mode

# Integration tests (Testcontainers)
pnpm test:integration        # Run integration tests with real PostgreSQL

# E2E tests (Playwright)
pnpm test:e2e                # Run all E2E tests
pnpm test:e2e:ui             # Interactive UI mode
pnpm test:e2e:debug          # Debug mode with inspector

# All tests
pnpm test:all                # Unit + Integration + E2E
```

## Test Structure

- **Unit tests:** Co-located with source files (e.g., `use-siwe-auth.test.tsx` next to `use-siwe-auth.ts`)
- **Integration tests:** `.int.test.ts` suffix, require PostgreSQL via Testcontainers
- **E2E tests:** `e2e/tests/` directory - see [E2E-TESTING.md](./E2E-TESTING.md)
- **Mock factories:** `test/mocks/` directory with path alias `@test/mocks/*`

## Type-Safe Mocking Principles

**Never use type casting (`as`) or `@ts-expect-error` to silence type errors in tests.** Instead:

1. **Create typed mock factories** that return properly typed objects
2. **Use `Extract<>` for discriminated unions** to get specific union members
3. **Use `vi.hoisted()` when mocks need to be referenced in `vi.mock()` factories**
4. **Export handlers separately** from route definitions for direct testing

## Mock Factory Pattern

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

## vi.hoisted() Pattern

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

## Extract<> for Discriminated Unions

Wagmi and other libraries use discriminated unions where the type depends on a `status` field:

```typescript
import type { UseConnectionReturnType, UseSignMessageReturnType } from "wagmi";

// Get the "connected" variant of the union
type ConnectedState = Extract<UseConnectionReturnType, { status: "connected" }>;

// Get the "idle" variant for mutation hooks
type IdleSignMessageState = Extract<UseSignMessageReturnType, { status: "idle" }>;
```

## Route Handler Testing

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

## Available Mock Factories

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

## JSDOM Environment for React Hooks

React hook tests require the jsdom environment. Add the directive at the top of the file:

```typescript
/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
// ...
```

## Common Mistakes to Avoid

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

## Integration Test Template

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";

describe("Database Integration", () => {
  let pool: Pool;
  const skipIfNoDb = !process.env.DATABASE_URL;

  beforeEach(async () => {
    if (skipIfNoDb) return;
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
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

## What's NOT Tested (By Design)

- **shadcn/ui components** - Already tested by the library
- **BetterAuth internals** (`auth.ts`) - Requires full integration setup
- **Nitro plugins** (`server/plugins/*`) - Require server runtime
- **Generated files** (`routeTree.gen.ts`)
- **Simple wrappers** (`use-media-query.ts`, `use-mobile.ts`)

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
