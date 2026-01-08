# E2E Testing Guide

This directory contains end-to-end tests for Dream Auth using [Playwright](https://playwright.dev/).

## Quick Start

```bash
# Install Playwright browsers (first time only)
pnpm exec playwright install chromium

# Run all E2E tests
pnpm test:e2e

# Run tests with UI mode (interactive debugging)
pnpm test:e2e:ui

# Run tests in debug mode
pnpm test:e2e:debug

# View test report
pnpm test:e2e:report
```

## Directory Structure

```
e2e/
├── fixtures/                 # Playwright fixtures for test setup
│   ├── auth-fixtures.ts     # Authentication helpers (login, register)
│   ├── database-fixtures.ts # Database access and cleanup
│   └── index.ts             # Combined fixtures export
├── helpers/
│   ├── test-user-factory.ts # Create test users
│   ├── navigation.ts        # Navigation utilities
│   └── assertions.ts        # Custom assertions
├── tests/
│   ├── auth/                # Authentication tests
│   │   ├── login.spec.ts
│   │   ├── register.spec.ts
│   │   └── logout.spec.ts
│   ├── protected-routes/    # Route protection tests
│   │   ├── auth-required.spec.ts
│   │   └── forward-auth.spec.ts
│   ├── health/              # Health check tests
│   │   └── health-check.spec.ts
│   └── oidc/                # OIDC provider tests
│       └── discovery.spec.ts
├── global-setup.ts          # Start DB + dev server
├── global-teardown.ts       # Cleanup
├── playwright.config.ts     # Playwright configuration
└── README.md
```

## Test Infrastructure

### Global Setup/Teardown

The E2E tests use a global setup that:

1. **Starts PostgreSQL** via Testcontainers (same as integration tests)
2. **Starts the dev server** on port 3001 (to avoid conflicts)
3. **Waits for health check** to pass before running tests
4. **Cleans up** both server and database after tests complete

### Database Isolation

Tests use transaction-based isolation:
- Each test runs within a database transaction
- Transaction is rolled back after each test
- This ensures tests don't affect each other

### Fixtures

Import fixtures from `@e2e/fixtures`:

```typescript
import { test, expect } from "@e2e/fixtures";

test("my test", async ({ page, pool, authenticatedPage }) => {
  // page - standard Playwright page
  // pool - PostgreSQL connection pool
  // authenticatedPage - page with logged-in user
});
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from "../../fixtures";

test.describe("Feature Name", () => {
  test("should do something", async ({ page }) => {
    await page.goto("/path");
    await page.fill('input[name="field"]', "value");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/success");
  });
});
```

### Using Fixtures

```typescript
import { test, expect } from "../../fixtures";
import { registerUser } from "../../helpers/navigation";

test("authenticated user can access settings", async ({ page }) => {
  // Register a user (creates session cookie)
  await registerUser(page, "Test User", "test@example.com", "Password123!");

  // Navigate to protected route
  await page.goto("/settings");

  // Should have access
  await expect(page).toHaveURL("/settings");
});
```

### Custom Assertions

```typescript
import { expectAuthenticated, expectOnLoginPage } from "../../helpers/assertions";

test("login redirects to home", async ({ page }) => {
  // ... login flow
  await expectAuthenticated(page);
});
```

## Configuration

### Environment Variables

Set in `global-setup.ts`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection (set by testcontainers) |
| `BETTER_AUTH_SECRET` | Test auth secret |
| `BETTER_AUTH_URL` | Base URL (http://localhost:3001) |
| `ENABLE_OIDC_PROVIDER` | Enable OIDC features |
| `OIDC_CLIENTS` | Test OIDC clients configuration |

### Playwright Config Options

Key settings in `playwright.config.ts`:

- **Workers**: 1 in CI (database stability), auto-detect locally
- **Retries**: 2 in CI, 0 locally
- **Screenshots/Video**: Captured only on failure
- **Trace**: Captured on first retry

## Extension Points

### Adding Passkey Tests (WebAuthn)

Playwright supports virtual authenticators for WebAuthn testing:

```typescript
// e2e/helpers/webauthn.ts
export async function createVirtualAuthenticator(page: Page) {
  const cdpSession = await page.context().newCDPSession(page);
  await cdpSession.send('WebAuthn.enable');

  const { authenticatorId } = await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });

  return { cdpSession, authenticatorId };
}
```

### Adding SIWE Tests (Wallet Mocking)

Mock the Ethereum provider via `page.addInitScript()`:

```typescript
// e2e/helpers/mock-wallet.ts
export async function injectMockWallet(page: Page, address: string) {
  await page.addInitScript((address) => {
    window.ethereum = {
      request: async ({ method }) => {
        if (method === 'eth_requestAccounts') return [address];
        if (method === 'personal_sign') return '0x...'; // Mock signature
      },
      on: () => {},
    };
  }, address);
}
```

### Adding Full OIDC Flow Tests

See the `oidc/discovery.spec.ts` for endpoint tests. For full flow tests:

```typescript
import { test, expect } from "@playwright/test";
import { generatePKCE } from "../helpers/pkce";

test("OIDC authorization code flow", async ({ page }) => {
  const { codeVerifier, codeChallenge } = generatePKCE();

  const authUrl = new URL("/oauth2/authorize", baseUrl);
  authUrl.searchParams.set("client_id", "test-client");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  // ... other params

  await page.goto(authUrl.toString());
  // ... complete login and consent
  // ... extract code and exchange for tokens
});
```

## Troubleshooting

### Tests timeout waiting for server

- Increase timeout in `global-setup.ts` (default: 120s)
- Check if Docker is running (required for testcontainers)
- Look for errors in the server output

### Database connection errors

- Ensure PostgreSQL container started successfully
- Check `DATABASE_URL` is set correctly
- Verify migrations ran (auto-migrate is enabled)

### Screenshots/videos not appearing

- They only appear on failure by default
- Check `test-results/` directory after failed runs
- Run with `--trace on` for detailed traces

### CI-specific issues

- CI uses single worker for database stability
- Testcontainers needs Docker-in-Docker or similar setup
- Check GitHub Actions logs for container startup errors

## CI/CD

The `.github/workflows/e2e.yml` workflow:

1. Installs dependencies
2. Installs Playwright browsers
3. Runs E2E tests with testcontainers
4. Uploads artifacts (reports, videos on failure)

Artifacts are retained for 7 days.

## Best Practices

1. **Unique test data**: Use `Date.now()` or UUIDs in test emails
2. **Explicit waits**: Use `page.waitForURL()` instead of arbitrary timeouts
3. **Isolated tests**: Don't rely on other tests' state
4. **Descriptive names**: Test names should describe the behavior
5. **Fixtures for setup**: Use fixtures for repeated setup logic
