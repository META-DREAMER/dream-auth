# E2E Testing Guide

This document describes the end-to-end testing infrastructure for Dream Auth using Playwright.

## Overview

The E2E testing setup uses:

- **Playwright** - Browser automation and testing framework
- **Testcontainers** - PostgreSQL database per test run
- **GitHub Actions** - CI/CD integration with artifacts

## Quick Start

```bash
# Install Playwright browsers (first time only)
pnpm exec playwright install chromium

# Run all E2E tests
pnpm test:e2e

# Run with interactive UI mode
pnpm test:e2e:ui

# Run in debug mode
pnpm test:e2e:debug

# View HTML test report
pnpm test:e2e:report
```

## Directory Structure

```
e2e/
├── fixtures/                 # Playwright fixtures
│   ├── auth-fixtures.ts     # Authentication helpers
│   ├── database-fixtures.ts # Database access and cleanup
│   └── index.ts             # Combined fixtures export
├── helpers/
│   ├── assertions.ts        # Custom assertions
│   ├── navigation.ts        # Navigation utilities
│   └── test-user-factory.ts # Test data creation
├── tests/
│   ├── auth/                # Authentication tests
│   │   ├── login.spec.ts
│   │   ├── register.spec.ts
│   │   └── logout.spec.ts
│   ├── health/              # Health check tests
│   │   └── health-check.spec.ts
│   ├── oidc/                # OIDC provider tests
│   │   └── discovery.spec.ts
│   └── protected-routes/    # Route protection tests
│       ├── auth-required.spec.ts
│       └── forward-auth.spec.ts
├── global-setup.ts          # Starts PostgreSQL container, writes .env.test.local
├── global-teardown.ts       # Stops container, removes .env.test.local
├── playwright.config.ts     # Playwright configuration
└── README.md                # Detailed E2E documentation
```

## Test Categories

### Health Checks (Passing)

- API health endpoint returns 200
- Application renders home page
- Login and register pages are accessible

### OIDC Discovery (Passing)

- `/.well-known/openid-configuration` returns valid OIDC config
- `/.well-known/jwks.json` returns valid JWKS
- PKCE support advertised correctly

### Protected Routes (Passing)

- Unauthenticated users redirected to login
- `/api/verify` returns 401 without session
- Redirect parameter preserved through login

### Authentication Flows (In Progress)

- Email/password login and registration
- Session persistence
- Logout functionality

## Architecture

### Global Setup/Teardown

The E2E tests use a global setup that:

1. Starts a PostgreSQL container via Testcontainers
2. Writes the dynamic `DATABASE_URL` to `.env.test.local`
3. Playwright's `webServer` spawns `pnpm dev --mode test`
4. Vite loads `.env.test` (static config) + `.env.test.local` (dynamic DATABASE_URL)
5. Global teardown stops container and removes `.env.test.local`

**Why file-based approach?** Playwright's `globalSetup` runs in a separate worker process. Any `process.env` modifications there are isolated and NOT inherited by the main Playwright process or its webServer child. Writing to `.env.test.local` leverages Vite's native env file loading.

**Configuration Sources:**

- **Static config**: `.env.test` contains BETTER_AUTH_SECRET, OIDC_CLIENTS, etc.
- **Dynamic config**: `.env.test.local` contains DATABASE_URL (from testcontainers)
- **Override**: Environment variables set in CI take precedence

### Database Isolation

Tests can use transaction-based isolation via the `databaseFixtures`:

- Each test gets a database client wrapped in a transaction
- Transaction is rolled back after each test
- Tests don't affect each other's data

### Fixtures

Import fixtures from the combined export:

```typescript
import { test, expect } from "../../fixtures";

test("my test", async ({ page, dbClient }) => {
  // page - Playwright page
  // dbClient - PostgreSQL client in transaction
});
```

## Writing Tests

### Basic Test

```typescript
import { test, expect } from "../../fixtures";

test.describe("Feature Name", () => {
  test("should do something", async ({ page }) => {
    await page.goto("/path");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page).toHaveURL("/success");
  });
});
```

### Using Navigation Helpers

```typescript
import { test } from "../../fixtures";
import { registerUser, loginAndNavigate } from "../../helpers/navigation";

test("authenticated user flow", async ({ page }) => {
  await registerUser(page, "Test User", "test@example.com", "Password123!");
  await page.waitForURL("/");
  // User is now authenticated
});
```

### Creating Test Users

```typescript
import { createTestUserViaAPI } from "../../helpers/test-user-factory";

test("with test user", async ({ page }) => {
  const user = await createTestUserViaAPI(page, {
    name: "Test User",
    email: "test@example.com",
    password: "Password123!",
  });
  // User exists in database
});
```

## CI/CD Integration

The `.github/workflows/e2e.yml` workflow:

1. Sets up Node.js and pnpm
2. Installs dependencies and Playwright browsers
3. Runs E2E tests with Testcontainers
4. Uploads HTML report and failure artifacts

Artifacts retained for 7 days:

- `playwright-report/` - HTML test report
- `test-results/` - Screenshots and videos on failure

## Extension Points

### Passkey Testing (WebAuthn)

Playwright supports virtual authenticators for WebAuthn testing. See `e2e/README.md` for implementation guide using Chrome DevTools Protocol.

### SIWE Testing (Ethereum Wallet)

Mock the Ethereum provider via `page.addInitScript()` to simulate wallet connections and message signing.

### Full OIDC Flow Testing

The OIDC client simulator in `e2e/helpers/oidc-client.ts` (to be implemented) provides:

- PKCE challenge generation
- Authorization URL building
- Token exchange
- ID token validation

## Troubleshooting

### Tests timeout waiting for server

- Increase timeout in `playwright.config.ts` (default: 120s)
- Ensure Docker is running for Testcontainers
- Check for port conflicts on 3001

### Database connection errors

- Verify PostgreSQL container started successfully
- Check logs for migration errors

### Form interaction failures

- Use `pnpm test:e2e:ui` for interactive debugging
- Check selectors match actual page labels
- Verify form is fully loaded before interaction

## Configuration

### Test Configuration

Static E2E test environment variables are defined in `.env.test`. The dynamic `DATABASE_URL` is written to `.env.test.local` at runtime by `global-setup.ts`.

**Configuration in `.env.test`:**

| Variable                   | Default Value                     |
| -------------------------- | --------------------------------- |
| `PORT`                     | `3001`                            |
| `DATABASE_URL`             | Set dynamically by Testcontainers |
| `NODE_ENV`                 | `test`                            |
| `SKIP_ENV_VALIDATION`      | `true`                            |
| `BETTER_AUTH_SECRET`       | Test secret (32+ chars)           |
| `BETTER_AUTH_URL`          | `http://localhost:3001`           |
| `BETTER_AUTH_AUTO_MIGRATE` | `true`                            |
| `ENABLE_REGISTRATION`      | `true`                            |
| `ENABLE_OIDC_PROVIDER`     | `true`                            |
| `ENABLE_PASSKEYS`          | `true`                            |
| `ENABLE_SIWE`              | `true`                            |
| `OIDC_REQUIRE_PKCE`        | `true`                            |
| `OIDC_CLIENTS`             | Test client JSON (2 clients)      |

**Overriding in GitHub Actions:**

To use different values in CI (e.g., production-like secrets), set environment variables in the workflow:

```yaml
- name: Run E2E tests
  run: pnpm test:e2e
  env:
    CI: true
    BETTER_AUTH_SECRET: ${{ secrets.TEST_BETTER_AUTH_SECRET }}
    # Other overrides as needed
```

**Overriding Locally:**

Set environment variables before running tests:

```bash
export BETTER_AUTH_SECRET="my-custom-secret"
pnpm test:e2e
```

### Playwright Config

Key settings in `e2e/playwright.config.ts`:

- **Workers**: 1 in CI for database stability
- **Retries**: 2 in CI, 0 locally
- **Screenshots/Video**: Only on failure
- **Trace**: On first retry
