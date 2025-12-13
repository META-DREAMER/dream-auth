# Auth Server Implementation Worklog

## Phase 1: Foundation (MVP) - COMPLETED

**Date:** December 9, 2024  
**Status:** Complete  
**Goal:** Minimal working auth server with password authentication

---

### Summary

Implemented the foundational MVP for the Auth Server, including BetterAuth integration with PostgreSQL, login/register pages with email/password authentication, forward-auth endpoint for Kubernetes ingress integration, and container deployment pipeline.

---

### Checklist from PRD

- [x] Project scaffolding (TanStack Start + Bun) - _Pre-existing from bootstrap_
- [x] BetterAuth integration with PostgreSQL
- [x] Login/Register pages with email + password
- [x] Forward-auth `/api/verify` endpoint
- [x] Basic UI with shadcn/ui and Tailwind
- [x] Dockerfile and GitHub Actions CI/CD
- [x] Health endpoint

---

### Files Created

#### Authentication Core

| File                     | Purpose                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/auth.ts`        | BetterAuth server configuration with PostgreSQL adapter, cookie settings, and TanStack Start integration via `tanstackStartCookies` plugin |
| `src/lib/auth-client.ts` | BetterAuth React client exporting `useSession`, `signIn`, `signUp`, `signOut` hooks                                                        |

#### API Routes

| File                       | Purpose                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/routes/api/auth/$.ts` | BetterAuth catch-all handler for `/api/auth/*` endpoints                                                                                   |
| `src/routes/api/verify.ts` | Forward-auth endpoint returning `200` with user headers (`X-Auth-User`, `X-Auth-Id`, `X-Auth-Email`) or `401` for unauthenticated requests |
| `src/routes/api/health.ts` | Health check endpoint for Kubernetes liveness/readiness probes                                                                             |

#### Pages

| File                      | Purpose                                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| `src/routes/login.tsx`    | Login page with email/password form, error handling, redirect support           |
| `src/routes/register.tsx` | Registration page with name, email, password fields and validation              |
| `src/routes/index.tsx`    | Home page showing welcome screen (unauthenticated) or user info (authenticated) |
| `src/routes/__root.tsx`   | Root layout with Auth Server branding, dark mode, Geist font                    |

#### Container & CI/CD

| File                             | Purpose                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `Dockerfile`                     | Multi-stage build with `oven/bun:1-alpine`, non-root user, health check      |
| `.dockerignore`                  | Excludes unnecessary files from container build                              |
| `.github/workflows/ci.yaml`      | PR validation workflow (lint, typecheck, build test)                         |
| `.github/workflows/release.yaml` | Release workflow with multi-arch image build, GHCR push, Trivy security scan |

#### Configuration

| File           | Purpose                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/env.ts`   | Environment variable schema with `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `COOKIE_DOMAIN`, `ENABLE_REGISTRATION`, `ADMIN_EMAILS` |
| `.env.example` | Environment variable documentation                                                                                                               |
| `biome.json`   | Updated to ignore `src/components/ui` (shadcn) folder                                                                                            |

---

### Dependencies Added

```
better-auth       - Authentication library
pg                - PostgreSQL client
@types/pg         - TypeScript types for pg
```

#### shadcn/ui Components Installed

- `button`
- `input`
- `label`
- `card`
- `form`

---

### Files Removed (Cleanup)

- `src/routes/demo/*` - All demo routes
- `src/data/demo.punk-songs.ts` - Demo data
- `src/components/Header.tsx` - Demo header component

---

### Design Decisions

1. **Dark mode by default** - Root layout sets `className="dark"` on `<html>` element
2. **Geist font** - Modern, clean typography loaded from Google Fonts
3. **Emerald/Cyan gradient accent** - Distinctive color scheme for buttons and icons
4. **Glassmorphism cards** - `bg-zinc-900/80 backdrop-blur-sm` for depth
5. **Static element IDs** - Disabled `useUniqueElementIds` lint rule for simpler form code

---

### Environment Variables Required

| Variable              | Required | Description                                     |
| --------------------- | -------- | ----------------------------------------------- |
| `DATABASE_URL`        | Yes      | PostgreSQL connection string                    |
| `BETTER_AUTH_SECRET`  | Yes      | Secret key for signing sessions (min 32 chars)  |
| `BETTER_AUTH_URL`     | Yes      | Public URL (e.g., `https://auth.domain.com`)    |
| `COOKIE_DOMAIN`       | Yes      | Parent domain for cookies (e.g., `.domain.com`) |
| `ENABLE_REGISTRATION` | No       | Allow public registration (default: `false`)    |
| `ADMIN_EMAILS`        | No       | Comma-separated admin email addresses           |

---

### Notes

- The project uses TanStack Start with file-based routing
- Server routes use the `server.handlers` pattern (not separate API route exports)
- BetterAuth's `tanstackStartCookies` plugin handles cookie management automatically
- The forward-auth endpoint is designed for nginx ingress `auth-url` annotation

---

## Phase 2: Passwordless - COMPLETED

**Date:** December 9, 2024  
**Status:** Complete  
**Goal:** Add passkey support for modern passwordless authentication

---

### Summary

Implemented WebAuthn passkey support using BetterAuth's passkey plugin. Users can now sign in using biometrics or security keys, and manage their registered passkeys from a settings page. React Query is used for data fetching and mutations.

---

### Checklist from PRD

- [x] BetterAuth passkey plugin integration
- [x] Passkey registration flow in settings
- [x] Passkey login button on login page
- [x] Passkey management UI (view/delete registered keys)

---

### Files Created

| File                                    | Purpose                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `src/routes/settings.tsx`               | Settings page with user profile and passkey management                           |
| `src/components/passkey-list.tsx`       | Component displaying user's passkeys with delete functionality using React Query |
| `src/components/add-passkey-dialog.tsx` | Dialog component for registering new passkeys with React Query mutation          |

#### shadcn/ui Components Installed

- `table`
- `alert-dialog`
- `separator`
- `skeleton`
- `badge`
- `dialog`

---

### Files Modified

| File                    | Changes                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `src/routes/__root.tsx` | Added React Query `QueryClientProvider` wrapper                                        |
| `src/routes/login.tsx`  | Added passkey sign-in button, conditional UI support, webauthn autocomplete attributes |
| `src/routes/index.tsx`  | Added Settings button link for authenticated users                                     |

---

### Dependencies Added

```
@tanstack/react-query  - Data fetching and caching library
```

---

### Key Features

1. **Passkey Login** - Users with registered passkeys see a "Sign in with Passkey" button on the login page
2. **Conditional UI** - Browsers supporting WebAuthn conditional mediation show passkey autofill suggestions
3. **Passkey Registration** - Authenticated users can register new passkeys from the settings page
4. **Passkey Management** - Users can view all registered passkeys and delete them with confirmation
5. **React Query Integration** - All passkey data operations use React Query for caching and optimistic updates

---

### API Methods Used

| Method                       | Purpose                                |
| ---------------------------- | -------------------------------------- |
| `signIn.passkey()`           | Authenticate with a registered passkey |
| `passkey.addPasskey()`       | Register a new passkey                 |
| `passkey.listUserPasskeys()` | List all passkeys for current user     |
| `passkey.deletePasskey()`    | Remove a registered passkey            |

---

---

## Phase 3: Web3 - COMPLETED

**Date:** December 10, 2024  
**Status:** Complete  
**Goal:** Add Ethereum wallet authentication (Sign-In With Ethereum)

---

### Summary

Implemented SIWE (Sign-In With Ethereum) authentication using BetterAuth's SIWE plugin and wagmi for wallet connectivity. Users can now authenticate using MetaMask or other Ethereum-compatible wallets, register with wallet-only accounts, and manage linked wallets from the settings page.

---

### Checklist from PRD

- [x] BetterAuth SIWE plugin integration
- [x] Wallet connect component (wagmi + injected connectors)
- [x] Wallet address display in user profile
- [x] Wallet-only registration option

---

### Files Created

| File                                          | Purpose                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/lib/wagmi.ts`                            | Wagmi configuration with injected wallet connectors and optional WalletConnect support           |
| `src/components/auth/connect-siwe-button.tsx` | SIWE authentication button with auto-trigger flow, ENS name/avatar display, and manual retry     |
| `src/components/auth/wallet-list.tsx`         | Display linked wallets with unlink functionality using React Query                               |
| `src/components/auth/link-wallet-dialog.tsx`  | Dialog for linking additional wallets to existing accounts with auto-trigger SIWE flow           |
| `src/hooks/use-siwe-auth.ts`                  | Custom hook encapsulating full SIWE flow: nonce request, message creation, signing, verification |
| `src/components/simplekit/*`                  | Custom wallet connection UI library (SimpleKit) providing wallet modal and connection state      |
| `src/components/web3-provider.tsx`            | React context provider wrapping WagmiProvider and SimpleKitProvider for wallet connectivity      |

---

### Files Modified

| File                              | Changes                                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/auth.ts`                 | Added SIWE plugin with nonce generation (using `generateSiweNonce` from viem), message verification (using viem's `verifyMessage`), and ENS lookup for name/avatar resolution |
| `src/lib/auth-client.ts`          | Added siweClient plugin, exported siwe namespace for client-side SIWE operations                                                                                              |
| `src/routes/__root.tsx`           | Added Web3Provider wrapper (combines WagmiProvider and SimpleKitProvider) for wallet connectivity                                                                             |
| `src/routes/login.tsx`            | Added ConnectSIWEButton component for wallet-based sign-in with error handling                                                                                                |
| `src/routes/register.tsx`         | Added ConnectSIWEButton component for wallet-only registration (no email required)                                                                                            |
| `src/routes/_authed/settings.tsx` | Added "Linked Wallets" card section with WalletList component and LinkWalletDialog for management                                                                             |
| `src/env.ts`                      | Added ENABLE_SIWE feature flag (defaults to `true`)                                                                                                                           |
| `src/env.client.ts`               | Added VITE_WALLETCONNECT_PROJECT_ID for optional WalletConnect mobile wallet support                                                                                          |

---

### Dependencies Added

```
wagmi     - React hooks for Ethereum wallet connectivity
viem      - Low-level Ethereum interface (required by wagmi)
siwe      - Sign-In With Ethereum message parsing and verification
```

---

### Key Features

1. **Wallet Sign-In** - Users can sign in by connecting their wallet and signing a SIWE message. Auto-triggers SIWE flow after wallet connection for seamless UX.
2. **Wallet Registration** - New users can register with just their wallet (no email required). SIWE verification automatically creates user account.
3. **Wallet Linking** - Authenticated users can link additional wallets to their account via account linking feature. Supports multiple wallets per user.
4. **Wallet Management** - Users can view all linked wallets (with address, linked date) and unlink them from the settings page with confirmation dialog.
5. **ENS Integration** - Displays ENS names and avatars when available for connected wallets, enhancing user experience.
6. **Nonce Security** - Server-side nonce generation using viem's `generateSiweNonce` with BetterAuth's internal storage and expiration for replay protection.
7. **Custom Wallet UI** - SimpleKit provides a custom wallet connection modal supporting injected wallets (MetaMask, Coinbase Wallet, Brave, etc.) and optional WalletConnect.
8. **Conditional Feature** - SIWE can be disabled via ENABLE_SIWE environment variable for deployments that don't need Web3 authentication.

---

### SIWE Authentication Flow

1. User clicks "Connect Wallet" button
2. Wallet extension prompts user to connect
3. Client requests nonce from BetterAuth server
4. Client creates SIWE message with nonce
5. Wallet prompts user to sign message
6. Client sends signature to server for verification
7. Server verifies signature and creates session
8. User is redirected to application

---

### Environment Variables Added

| Variable                        | Required | Description                                  |
| ------------------------------- | -------- | -------------------------------------------- |
| `ENABLE_SIWE`                   | No       | Enable SIWE authentication (default: `true`) |
| `VITE_WALLETCONNECT_PROJECT_ID` | No       | WalletConnect project ID for mobile wallets  |

---

### API Methods Used

| Method                       | Purpose                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `siwe.nonce()`               | Get nonce for SIWE message from server (via BetterAuth client)                        |
| `createSiweMessage()` (viem) | Create EIP-4361 SIWE message client-side using viem's utility (bypasses siwe v3 bugs) |
| `signMessageAsync()` (wagmi) | Sign SIWE message with connected wallet via wagmi's useSignMessage hook               |
| `siwe.verify()`              | Verify signature and authenticate/link account (via BetterAuth client)                |
| `authClient.listAccounts()`  | List linked accounts including wallets (filters for `providerId === "siwe"`)          |
| `authClient.unlinkAccount()` | Unlink a wallet from account by providerId and accountId                              |

---

### Technical Notes

1. **SIWE Message Creation**: The SIWE message is created client-side using viem's `createSiweMessage` utility function (from `viem/siwe`), which bypasses known bugs in the `siwe` v3 package's `SiweMessage` constructor. The message follows EIP-4361 standard format with domain, address, statement, URI, version, chainId, and nonce.

2. **Server Verification**: Uses viem's `verifyMessage` function for cryptographic signature verification (recommended by BetterAuth docs). The server-side SIWE plugin configuration includes custom `verifyMessage` callback that validates the signature against the message and wallet address.

3. **ENS Lookup**: Server-side ENS name and avatar resolution is implemented in the SIWE plugin's `ensLookup` callback using viem's public client. This enhances the user experience by displaying human-readable names instead of raw addresses.

4. **Account Linking**: Enabled via `accountLinking.enabled: true` in server config with `trustedProviders: ["siwe", "email-password", "email-otp"]`. When a logged-in user verifies a new wallet, it's automatically linked to their account. Supports linking multiple wallets to a single user account.

5. **Nonce Management**: Server generates cryptographically secure random nonces using viem's `generateSiweNonce()`. BetterAuth handles nonce storage and validation internally with expiration for replay protection.

6. **Wallet Connection Flow**: Uses custom SimpleKit library for wallet connection UI, providing a unified modal interface for injected wallets (MetaMask, Coinbase Wallet, Brave, etc.) and optional WalletConnect support. The connection state is managed via wagmi hooks.

7. **Auto-Trigger Pattern**: The `ConnectSIWEButton` and `LinkWalletDialog` components implement an auto-trigger pattern where SIWE authentication automatically starts after wallet connection, with manual retry always available. This reduces friction in the authentication flow.

8. **Error Handling**: Comprehensive error handling with automatic wallet disconnection on authentication failure (configurable via `disconnectOnError` option), preventing stuck states.

9. **React Query Integration**: Wallet list management uses React Query for data fetching, caching, and optimistic updates, ensuring consistent UI state.

---

---

## Phase 4: OIDC Provider - COMPLETED

**Date:** December 11-12, 2024  
**Status:** Complete  
**Goal:** Enable OIDC for applications that require it (Grafana, Immich, Weave GitOps)

---

### Summary

Implementing the auth server as an OpenID Connect provider using BetterAuth's OIDC provider plugin. This enables SSO for Kubernetes applications that support OIDC authentication.

---

### Critical Design Decision: Issuer + Endpoint Shape

**Decision: Option B (Root Issuer + Root Endpoints)**

After evaluating both options from the implementation plan, we chose **Option B** for the following reasons:

1. **Drop-in IdP compatibility**: Most OIDC clients expect the issuer to be at the domain root
2. **Cleaner URLs**: `https://auth.domain.com` vs `https://auth.domain.com/api/auth`
3. **Standard discovery path**: `/.well-known/openid-configuration` at root is universally expected

**Implementation approach:**

- BetterAuth remains mounted at `/api/auth/*` (existing auth API unchanged)
- TanStack Start server routes added as aliases at root level:
  - `/.well-known/openid-configuration` → proxies to `/api/auth/.well-known/openid-configuration`
  - `/.well-known/jwks.json` → proxies to `/api/auth/.well-known/jwks.json`
  - `/oauth2/*` → proxies to `/api/auth/oauth2/*`
- The discovery endpoint rewrites all URLs to use root-level paths

**Resulting endpoint structure:**

| Endpoint      | URL                                                        |
| ------------- | ---------------------------------------------------------- |
| Issuer        | `https://auth.domain.com`                                  |
| Discovery     | `https://auth.domain.com/.well-known/openid-configuration` |
| JWKS          | `https://auth.domain.com/.well-known/jwks.json`            |
| Authorization | `https://auth.domain.com/oauth2/authorize`                 |
| Token         | `https://auth.domain.com/oauth2/token`                     |
| UserInfo      | `https://auth.domain.com/oauth2/userinfo`                  |
| End Session   | `https://auth.domain.com/oauth2/endsession`                |

---

### Checklist from PRD

- [x] BetterAuth OIDC provider plugin
- [x] OIDC client configuration via environment/YAML (JSON env support)
- [x] Consent screen implementation
- [x] Discovery and token endpoints (via root alias routes)
- [x] OIDC client configuration via mounted file (OIDC_CLIENTS_FILE)
- [x] JWT signing key rotation policy documentation
- [x] Integration notes for Immich/Grafana/Weave GitOps
- [x] Validation checklist and smoke tests
- [x] GitOps-friendly OIDC client DB seeding (fixes trustedClients FK constraint issue)

---

### Files Created

| File                                               | Purpose                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/routes/[.]well-known/openid-configuration.ts` | Root-level OIDC discovery endpoint, rewrites URLs from /api/auth to root |
| `src/routes/[.]well-known/jwks[.]json.ts`          | Root-level JWKS endpoint with caching headers                            |
| `src/routes/oauth2/$.ts`                           | Catch-all proxy for OAuth2 endpoints at root level                       |
| `src/routes/consent.tsx`                           | OAuth consent page with scope descriptions and user info display         |
| `src/lib/oidc/sync-oidc-clients.ts`                | OIDC client DB seeding module (validates + upserts clients on startup)   |
| `scripts/verify-oidc-clients.sh`                   | Script to verify OIDC clients are seeded in the database                 |

---

### Files Modified

| File                       | Changes                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/lib/auth.ts`          | Added oidcProvider plugin with PKCE, scopes, JWT integration, trusted clients, storeClientSecret |
| `src/lib/auth-client.ts`   | Added oidcClient plugin, exported oauth2 namespace                                               |
| `src/env.ts`               | Added ENABLE_OIDC_PROVIDER, OIDC_CLIENTS, OIDC_REQUIRE_PKCE; extended schema with `type` field   |
| `src/routes/api/auth/$.ts` | Added OIDC client seeding gate to ensure FK integrity before handling auth requests              |

---

### OIDC Hardening Defaults

1. **PKCE Required**: `requirePKCE: true` - Aligns with OAuth 2.1 security best practices
2. **Explicit Scopes**: `openid`, `profile`, `email`, `offline_access`
3. **JWT Plugin**: Enabled for asymmetric token signing (required for ID tokens)
4. **Disabled /token endpoint**: BetterAuth's generic `/token` disabled, OIDC uses `/oauth2/token`

---

### Environment Variables Added

| Variable               | Required | Default | Description                                      |
| ---------------------- | -------- | ------- | ------------------------------------------------ |
| `ENABLE_OIDC_PROVIDER` | No       | `false` | Enable OIDC provider functionality               |
| `OIDC_CLIENTS`         | No       | `[]`    | JSON array of trusted OIDC client configurations |
| `OIDC_REQUIRE_PKCE`    | No       | `true`  | Require PKCE for all OAuth flows                 |

---

### OIDC Client Configuration Schema

```typescript
{
  clientId: string;       // Unique client identifier
  clientSecret?: string;  // Client secret (required unless type="public")
  name: string;           // Display name shown on consent screen
  type?: "web" | "native" | "user-agent-based" | "public"; // Client type (default: "web")
  redirectURLs: string[]; // Allowed redirect URIs (at least one required)
  skipConsent?: boolean;  // Skip consent screen for trusted clients
  disabled?: boolean;     // Disable this client
  icon?: string;          // Icon URL for consent screen
  metadata?: object;      // Optional metadata
  userId?: string;        // Optional owner user ID
}
```

| Field          | Required | Description                                                                 |
| -------------- | -------- | --------------------------------------------------------------------------- |
| `clientId`     | Yes      | Unique client identifier                                                    |
| `clientSecret` | No\*     | Secret for confidential clients (\*required unless type="public")           |
| `name`         | Yes      | Display name for consent screen                                             |
| `type`         | No       | Client type: "web", "native", "user-agent-based", "public" (default: "web") |
| `redirectURLs` | Yes      | Array of allowed redirect URIs                                              |
| `skipConsent`  | No       | Skip consent for trusted clients (default: false)                           |
| `disabled`     | No       | Disable the client (default: false)                                         |
| `icon`         | No       | Icon URL for consent screen                                                 |
| `metadata`     | No       | Additional metadata as JSON object                                          |
| `userId`       | No       | Optional owner user ID                                                      |

Example environment variable:

```bash
OIDC_CLIENTS='[{"clientId":"grafana","clientSecret":"super-secret","name":"Grafana","type":"web","redirectURLs":["https://grafana.example.com/login/generic_oauth"],"skipConsent":true}]'
```

Example public client (PKCE only, no secret):

```json
{
  "clientId": "mobile-app",
  "name": "Mobile App",
  "type": "public",
  "redirectURLs": ["myapp://callback"],
  "skipConsent": true
}
```

---

### JWT Signing Keys + JWKS Strategy

#### Key Generation

BetterAuth's JWT plugin automatically generates RSA key pairs for signing ID tokens and access tokens. The keys are stored in the database (`jwks` table).

#### Key Storage (Kubernetes)

For production Kubernetes deployments, keys persist in the PostgreSQL database. This ensures:

- Keys survive pod restarts
- Keys are consistent across replicas (if scaled)
- No additional Kubernetes Secret management needed

#### Key Rotation Policy

**Recommended approach:**

| Setting               | Value   | Rationale                                         |
| --------------------- | ------- | ------------------------------------------------- |
| **Rotation interval** | 90 days | Balance between security and operational overhead |
| **Grace period**      | 7 days  | Allow time for cached tokens to expire            |
| **Algorithm**         | RS256   | Industry standard, widely supported               |

**Rotation procedure (GitOps):**

1. BetterAuth handles rotation automatically when configured
2. New key is generated and added to JWKS
3. Old key remains valid during grace period
4. JWKS endpoint always returns all valid keys
5. Clients refresh JWKS based on cache headers (1 hour max-age)

**Manual rotation (if needed):**

```bash
# Connect to auth-server pod
kubectl exec -it deploy/auth-server -n auth -- sh

# Trigger key rotation (if BetterAuth provides CLI)
# Or delete old keys from database and restart pod
```

#### JWKS Caching

The `/.well-known/jwks.json` endpoint includes caching headers:

```
Cache-Control: public, max-age=3600, must-revalidate
```

This allows clients to cache JWKS for 1 hour while enabling revalidation during key rotation.

---

### Database Migrations Strategy

#### BetterAuth Migration Tables

The OIDC provider plugin adds the following tables to the database:

- `oauth_application` — Registered OIDC clients (if using dynamic registration)
- `oauth_access_token` — Issued access tokens
- `oauth_authorization_code` — Authorization codes (short-lived)
- `oauth_consent` — User consent records
- `jwks` — JWT signing keys

#### Local Development

Run migrations manually using BetterAuth CLI:

```bash
# Generate migration SQL
pnpm dlx @better-auth/cli generate

# Apply migrations (or let BetterAuth auto-apply on startup)
pnpm dlx @better-auth/cli migrate
```

#### Kubernetes/GitOps Deployment

**Recommended approach: Pre-deploy Helm hook job**

This is the safest approach for GitOps deployments:

```yaml
# migration-job.yaml (Helm hook)
apiVersion: batch/v1
kind: Job
metadata:
  name: auth-server-migrate
  annotations:
    helm.sh/hook: pre-install,pre-upgrade
    helm.sh/hook-weight: "-5"
    helm.sh/hook-delete-policy: hook-succeeded
spec:
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: migrate
          image: ghcr.io/<org>/auth-server:latest
          command: ["bun", "run", "migrate"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: auth-server-secret
                  key: database-url
```

**Alternative: initContainer (simpler, but blocks pod startup)**

```yaml
initContainers:
  - name: migrate
    image: ghcr.io/<org>/auth-server:latest
    command: ["bun", "run", "migrate"]
    env:
      - name: DATABASE_URL
        valueFrom:
          secretKeyRef:
            name: auth-server-secret
            key: database-url
```

**Not recommended: Startup migrations**

Running migrations in the application startup is discouraged because:

- Race conditions with multiple replicas
- Slow startup times
- Rollback complexity

#### Migration Safety

1. **Backwards compatible**: Schema changes should not break running pods
2. **Idempotent**: Migrations can run multiple times safely
3. **Tested locally**: Always test migrations against a local database first
4. **Backups**: Ensure CloudNative-PG scheduled backups before migrations

---

### OIDC Client Configuration (File Support)

In addition to the `OIDC_CLIENTS` environment variable, the auth server supports loading clients from a mounted file:

**Environment variable:**

```bash
OIDC_CLIENTS_FILE=/config/oidc-clients.json
```

**Example file content (JSON):**

```json
[
  {
    "clientId": "grafana",
    "clientSecret": "super-secret-value",
    "name": "Grafana",
    "type": "web",
    "redirectURLs": ["https://grafana.example.com/login/generic_oauth"],
    "skipConsent": true,
    "disabled": false
  },
  {
    "clientId": "weave-gitops",
    "clientSecret": "another-secret",
    "name": "Weave GitOps",
    "type": "web",
    "redirectURLs": ["https://gitops.example.com/oauth2/callback"],
    "skipConsent": true
  }
]
```

**Kubernetes ConfigMap example:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: auth-oidc-clients
data:
  oidc-clients.json: |
    [
      {
        "clientId": "grafana",
        "clientSecret": "{{ .Values.grafana.oidcSecret }}",
        "name": "Grafana",
        "redirectURLs": ["https://grafana.example.com/login/generic_oauth"],
        "skipConsent": true
      }
    ]
---
# In the deployment, mount the ConfigMap
volumes:
  - name: oidc-config
    configMap:
      name: auth-oidc-clients
volumeMounts:
  - name: oidc-config
    mountPath: /config
env:
  - name: OIDC_CLIENTS_FILE
    value: /config/oidc-clients.json
```

**Note:** For secrets in GitOps, use SOPS encryption or external secrets operator. The `clientSecret` values should come from encrypted secrets, not plain ConfigMaps.

---

### OIDC Client DB Seeding (GitOps Fix)

#### The Problem

BetterAuth's `trustedClients` configuration in the OIDC provider plugin does **not** automatically persist clients to the `oauthApplication` database table. This causes a foreign key constraint violation when issuing tokens:

```
Error: insert or update on table "oauthAccessToken" violates foreign key constraint
Key (clientId)=(my-client) is not present in table "oauthApplication".
```

This is documented in [Better Auth issue #6649](https://github.com/better-auth/better-auth/issues/6649).

The root cause:

1. `trustedClients` are validated in-memory during authorization (bypasses DB lookup)
2. Token issuance creates `oauthAccessToken` rows with `clientId` foreign key
3. FK constraint requires `clientId` exists in `oauthApplication` table
4. Since `trustedClients` are never inserted into the database, the FK fails

#### The Solution

Implemented automatic OIDC client DB seeding that runs on first auth request:

1. **On startup/first request**: Load configured clients from `OIDC_CLIENTS` env or `OIDC_CLIENTS_FILE`
2. **Validate**: Check redirectURLs, clientSecret requirements, duplicate detection
3. **Upsert**: Use `INSERT...ON CONFLICT DO UPDATE` for idempotent DB persistence
4. **Then proceed**: Handle auth request normally

This ensures FK integrity before any `/oauth2/token` operations.

#### Implementation Details

**New module: `src/lib/oidc/sync-oidc-clients.ts`**

- `ensureOidcClientsSeeded(pool, clients)` - Singleton promise for idempotent seeding
- Validates all clients before DB operations
- Uses a single transaction for atomicity
- Never logs secrets (only client IDs)
- Safe for concurrent startup (multiple pods)

**Auth handler gate: `src/routes/api/auth/$.ts`**

```typescript
async function ensureOidcReady(): Promise<void> {
  if (serverEnv.ENABLE_OIDC_PROVIDER) {
    await ensureOidcClientsSeeded(pool, serverEnvWithOidc.OIDC_CLIENTS);
  }
}

// Both GET and POST handlers await this before auth.handler()
```

**Database columns (oauthApplication table):**

| Column         | Source                                  |
| -------------- | --------------------------------------- |
| `id`           | Generated UUID                          |
| `clientId`     | From config                             |
| `clientSecret` | From config (plain text, as configured) |
| `name`         | From config                             |
| `icon`         | From config (optional)                  |
| `redirectUrls` | `redirectURLs.join(",")` from config    |
| `metadata`     | `JSON.stringify(metadata)` from config  |
| `type`         | From config (web/native/public/etc.)    |
| `disabled`     | From config (default: false)            |
| `userId`       | From config (optional)                  |
| `createdAt`    | Set on insert                           |
| `updatedAt`    | Set on insert and update                |

#### GitOps Pattern: Single Source of Truth

To avoid duplicating `clientId` and `clientSecret` values in multiple places:

1. **Create one K8s Secret per client** (e.g., `immich-oidc-credentials`)
2. **Reference that Secret** from both:
   - Dream Auth deployment (to build OIDC clients config)
   - Application deployment (to configure OAuth settings)

Example with SOPS/External Secrets:

```yaml
# Single source of truth
apiVersion: v1
kind: Secret
metadata:
  name: immich-oidc
stringData:
  CLIENT_ID: immich
  CLIENT_SECRET: generated-secret-here
---
# Dream Auth references it
env:
  - name: OIDC_CLIENTS
    value: '[{"clientId":"$(IMMICH_CLIENT_ID)","clientSecret":"$(IMMICH_CLIENT_SECRET)","name":"Immich","type":"web","redirectURLs":["https://immich.example.com/auth/login"]}]'
envFrom:
  - secretRef:
      name: immich-oidc
      prefix: IMMICH_
---
# Immich references the same secret
env:
  - name: OAUTH_CLIENT_ID
    valueFrom:
      secretKeyRef:
        name: immich-oidc
        key: CLIENT_ID
  - name: OAUTH_CLIENT_SECRET
    valueFrom:
      secretKeyRef:
        name: immich-oidc
        key: CLIENT_SECRET
```

#### Verification

Check that clients are seeded:

```bash
# Console output on first request
[OIDC] Loaded 1 client(s): immich
[OIDC] Seeding 1 client(s) to database: immich
[OIDC] Successfully seeded 1 client(s) to database

# Or query the database directly
./scripts/verify-oidc-clients.sh $DATABASE_URL
```

---

### Integration Notes for Kubernetes Applications

#### Grafana

Grafana supports generic OAuth/OIDC authentication.

**Auth Server OIDC Client Config:**

```json
{
  "clientId": "grafana",
  "clientSecret": "your-secure-secret",
  "name": "Grafana",
  "type": "web",
  "redirectURLs": ["https://grafana.example.com/login/generic_oauth"],
  "skipConsent": true
}
```

**Grafana Configuration (grafana.ini or environment):**

```ini
[auth.generic_oauth]
enabled = true
name = Home Auth
client_id = grafana
client_secret = your-secure-secret
scopes = openid profile email
auth_url = https://auth.example.com/oauth2/authorize
token_url = https://auth.example.com/oauth2/token
api_url = https://auth.example.com/oauth2/userinfo
use_pkce = true
allow_sign_up = true
```

**Or as environment variables:**

```yaml
env:
  GF_AUTH_GENERIC_OAUTH_ENABLED: "true"
  GF_AUTH_GENERIC_OAUTH_NAME: "Home Auth"
  GF_AUTH_GENERIC_OAUTH_CLIENT_ID: "grafana"
  GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET: "your-secure-secret"
  GF_AUTH_GENERIC_OAUTH_SCOPES: "openid profile email"
  GF_AUTH_GENERIC_OAUTH_AUTH_URL: "https://auth.example.com/oauth2/authorize"
  GF_AUTH_GENERIC_OAUTH_TOKEN_URL: "https://auth.example.com/oauth2/token"
  GF_AUTH_GENERIC_OAUTH_API_URL: "https://auth.example.com/oauth2/userinfo"
  GF_AUTH_GENERIC_OAUTH_USE_PKCE: "true"
  GF_AUTH_GENERIC_OAUTH_ALLOW_SIGN_UP: "true"
```

---

#### Immich

Immich (photo management) supports OIDC for authentication.

**Auth Server OIDC Client Config:**

```json
{
  "clientId": "immich",
  "clientSecret": "your-secure-secret",
  "name": "Immich",
  "type": "web",
  "redirectURLs": [
    "https://immich.example.com/auth/login",
    "https://immich.example.com/user-settings",
    "app.immich:///oauth-callback"
  ],
  "skipConsent": true
}
```

**Immich Configuration (Admin Settings > OAuth):**

| Setting       | Value                                  |
| ------------- | -------------------------------------- |
| Issuer URL    | `https://auth.example.com`             |
| Client ID     | `immich`                               |
| Client Secret | `your-secure-secret`                   |
| Scope         | `openid profile email`                 |
| Auto Register | ✓ (if you want new users auto-created) |
| Auto Launch   | Optional                               |

**Or via environment variables:**

```yaml
env:
  OAUTH_ENABLED: "true"
  OAUTH_ISSUER_URL: "https://auth.example.com"
  OAUTH_CLIENT_ID: "immich"
  OAUTH_CLIENT_SECRET: "your-secure-secret"
  OAUTH_SCOPE: "openid profile email"
  OAUTH_AUTO_REGISTER: "true"
  OAUTH_BUTTON_TEXT: "Sign in with Home Auth"
```

**Note:** Immich uses the `/.well-known/openid-configuration` discovery endpoint automatically when given the issuer URL.

---

#### Weave GitOps (FluxCD UI)

Weave GitOps provides a UI for FluxCD and supports OIDC for authentication.

**Auth Server OIDC Client Config:**

```json
{
  "clientId": "weave-gitops",
  "clientSecret": "your-secure-secret",
  "name": "Weave GitOps",
  "type": "web",
  "redirectURLs": ["https://gitops.example.com/oauth2/callback"],
  "skipConsent": true
}
```

**Weave GitOps Helm Values:**

```yaml
# values.yaml for weave-gitops chart
oidcSecret:
  create: true
  clientID: weave-gitops
  clientSecret: your-secure-secret
  issuerURL: https://auth.example.com
  redirectURL: https://gitops.example.com/oauth2/callback

# Or reference an existing secret
oidcSecret:
  create: false
  existingSecret: weave-gitops-oidc
  existingSecretKeys:
    issuerURL: issuer-url
    clientID: client-id
    clientSecret: client-secret
    redirectURL: redirect-url
```

**Kubernetes Secret (if not using Helm secret creation):**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: weave-gitops-oidc
  namespace: flux-system
stringData:
  issuer-url: https://auth.example.com
  client-id: weave-gitops
  client-secret: your-secure-secret
  redirect-url: https://gitops.example.com/oauth2/callback
```

**Note:** Weave GitOps uses the OIDC discovery endpoint automatically. Ensure the auth server's `/.well-known/openid-configuration` is accessible from the cluster.

---

#### Common Discovery URL Pattern

All applications should use:

| Setting                    | Value                                                       |
| -------------------------- | ----------------------------------------------------------- |
| **Issuer / Discovery URL** | `https://auth.example.com`                                  |
| **Discovery Endpoint**     | `https://auth.example.com/.well-known/openid-configuration` |

Most OIDC libraries automatically append `/.well-known/openid-configuration` when given just the issuer URL.

---

### Validation Checklist

Use this checklist to verify OIDC provider functionality:

#### Discovery Endpoint

- [ ] `GET /.well-known/openid-configuration` returns 200
- [ ] Response has correct `issuer` (root URL, not `/api/auth`)
- [ ] `authorization_endpoint` points to `/oauth2/authorize`
- [ ] `token_endpoint` points to `/oauth2/token`
- [ ] `userinfo_endpoint` points to `/oauth2/userinfo`
- [ ] `jwks_uri` points to `/.well-known/jwks.json`

**Test command:**

```bash
curl -s https://auth.example.com/.well-known/openid-configuration | jq .
```

#### JWKS Endpoint

- [ ] `GET /.well-known/jwks.json` returns 200
- [ ] Response contains valid `keys` array
- [ ] At least one RSA key present (kty: "RSA", use: "sig")
- [ ] Cache-Control header present

**Test command:**

```bash
curl -s https://auth.example.com/.well-known/jwks.json | jq .
```

#### Authorization Code Flow

- [ ] `/oauth2/authorize` redirects to login (when unauthenticated)
- [ ] After login, consent page displays (if not skipConsent)
- [ ] Consent approval redirects with `code` parameter
- [ ] Consent denial redirects with `error` parameter
- [ ] Token exchange (`/oauth2/token`) returns access_token and id_token
- [ ] Userinfo endpoint returns user claims

**Manual test flow:**

1. Open browser: `https://auth.example.com/oauth2/authorize?client_id=test&redirect_uri=https://app.example.com/callback&response_type=code&scope=openid%20profile%20email&code_challenge=XXXX&code_challenge_method=S256`
2. Login if prompted
3. Approve consent
4. Note the `code` in redirect URL
5. Exchange code for tokens

#### PKCE Validation

- [ ] Request without PKCE fails (if OIDC_REQUIRE_PKCE=true)
- [ ] Request with invalid code_verifier fails
- [ ] Request with valid PKCE succeeds

#### Consent Flow

- [ ] skipConsent=true clients bypass consent screen
- [ ] skipConsent=false clients show consent screen
- [ ] Deny button returns error to client
- [ ] Approve button redirects with code

---

### Smoke Test Script

A simple script to validate OIDC discovery and JWKS endpoints:

**File: `scripts/oidc-smoke-test.sh`**

```bash
#!/bin/bash
# OIDC Smoke Test Script
# Usage: ./scripts/oidc-smoke-test.sh https://auth.example.com

set -e

AUTH_URL="${1:-http://localhost:3000}"

echo "🔍 Testing OIDC endpoints at $AUTH_URL"
echo ""

# Test discovery endpoint
echo "1. Testing discovery endpoint..."
DISCOVERY=$(curl -sf "$AUTH_URL/.well-known/openid-configuration")
if [ $? -ne 0 ]; then
  echo "❌ Discovery endpoint failed"
  exit 1
fi

ISSUER=$(echo "$DISCOVERY" | jq -r '.issuer')
AUTH_ENDPOINT=$(echo "$DISCOVERY" | jq -r '.authorization_endpoint')
TOKEN_ENDPOINT=$(echo "$DISCOVERY" | jq -r '.token_endpoint')
JWKS_URI=$(echo "$DISCOVERY" | jq -r '.jwks_uri')

echo "   ✅ Discovery endpoint OK"
echo "   - Issuer: $ISSUER"
echo "   - Auth endpoint: $AUTH_ENDPOINT"
echo "   - Token endpoint: $TOKEN_ENDPOINT"
echo "   - JWKS URI: $JWKS_URI"
echo ""

# Validate issuer matches expected
if [[ "$ISSUER" != "$AUTH_URL" ]]; then
  echo "⚠️  Warning: Issuer ($ISSUER) does not match auth URL ($AUTH_URL)"
fi

# Test JWKS endpoint
echo "2. Testing JWKS endpoint..."
JWKS=$(curl -sf "$JWKS_URI")
if [ $? -ne 0 ]; then
  echo "❌ JWKS endpoint failed"
  exit 1
fi

KEY_COUNT=$(echo "$JWKS" | jq '.keys | length')
echo "   ✅ JWKS endpoint OK"
echo "   - Key count: $KEY_COUNT"
echo ""

if [ "$KEY_COUNT" -eq 0 ]; then
  echo "⚠️  Warning: No keys in JWKS (might be normal on first startup)"
fi

# Test authorization endpoint (expect redirect or HTML)
echo "3. Testing authorization endpoint..."
AUTH_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$AUTH_ENDPOINT?client_id=test&response_type=code&redirect_uri=https://example.com/callback&scope=openid" 2>/dev/null || echo "302")
if [[ "$AUTH_STATUS" == "302" || "$AUTH_STATUS" == "200" ]]; then
  echo "   ✅ Authorization endpoint OK (status: $AUTH_STATUS)"
else
  echo "   ⚠️  Authorization endpoint returned: $AUTH_STATUS"
fi
echo ""

echo "🎉 Smoke test complete!"
```

Run the smoke test:

```bash
chmod +x scripts/oidc-smoke-test.sh
./scripts/oidc-smoke-test.sh https://auth.example.com
```

---

### Technical Notes

1. **TanStack Start Server Routes**: The alias routes use TanStack Start's server route pattern with `createFileRoute` and `server.handlers`. The `[.]` syntax in filenames escapes literal dots (e.g., `[.]well-known` → `.well-known`).

2. **Response Rewriting**: The openid-configuration endpoint rewrites all URLs from BetterAuth's internal `/api/auth/*` paths to root-level paths. This enables Option B (root issuer) while keeping BetterAuth mounted at its default location.

3. **Splat Routes**: The `/oauth2/*` catch-all uses TanStack's splat parameter (`$`) which captures the remaining path in `params._splat`.

4. **Request Proxying**: Requests are proxied to BetterAuth's handler by constructing a new `Request` object with the modified URL and forwarding to `auth.handler()`.

5. **Caching**: JWKS endpoint includes `Cache-Control: public, max-age=3600, must-revalidate` for performance while allowing key rotation.

6. **OIDC Client Merging**: Clients from `OIDC_CLIENTS` env var and `OIDC_CLIENTS_FILE` are merged, with duplicate detection and fail-fast behavior in production.

---

### Files Created in Phase 4

| File                                               | Purpose                            |
| -------------------------------------------------- | ---------------------------------- |
| `src/routes/[.]well-known/openid-configuration.ts` | OIDC discovery endpoint at root    |
| `src/routes/[.]well-known/jwks[.]json.ts`          | JWKS endpoint at root              |
| `src/routes/oauth2/$.ts`                           | OAuth2 endpoints catch-all at root |
| `src/routes/consent.tsx`                           | OAuth consent page                 |
| `scripts/oidc-smoke-test.sh`                       | OIDC validation smoke test script  |

---

### Next Steps (Phase 5: Polish)

According to the PRD, Phase 5 will focus on production hardening:

- [ ] Admin panel for user management
- [ ] Session management UI (view/revoke)
- [ ] Rate limiting on auth endpoints
- [ ] Improved error handling and logging
- [ ] Prometheus metrics endpoint (optional)
