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

| File                                       | Purpose                                                    |
| ------------------------------------------ | ---------------------------------------------------------- |
| `src/lib/wagmi.ts`                         | Wagmi configuration with injected wallet connectors        |
| `src/components/wallet-connect-button.tsx` | SIWE authentication button handling full sign-in flow      |
| `src/components/wallet-list.tsx`           | Display linked wallets with unlink functionality           |
| `src/components/link-wallet-dialog.tsx`    | Dialog for linking additional wallets to existing accounts |

---

### Files Modified

| File                              | Changes                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| `src/lib/auth.ts`                 | Added SIWE plugin with nonce generation and message verification |
| `src/lib/auth-client.ts`          | Added siweClient plugin, exported siwe namespace                 |
| `src/routes/__root.tsx`           | Added WagmiProvider wrapper for wallet connectivity              |
| `src/routes/login.tsx`            | Added wallet connect button for SIWE sign-in                     |
| `src/routes/register.tsx`         | Added wallet-only registration option                            |
| `src/routes/_authed/settings.tsx` | Added linked wallets section with management UI                  |
| `src/env.ts`                      | Added ENABLE_SIWE feature flag                                   |
| `src/env.client.ts`               | Added VITE_WALLETCONNECT_PROJECT_ID for optional WalletConnect   |

---

### Dependencies Added

```
wagmi     - React hooks for Ethereum wallet connectivity
viem      - Low-level Ethereum interface (required by wagmi)
siwe      - Sign-In With Ethereum message parsing and verification
```

---

### Key Features

1. **Wallet Sign-In** - Users can sign in by connecting their wallet and signing a SIWE message
2. **Wallet Registration** - New users can register with just their wallet (no email required)
3. **Wallet Linking** - Authenticated users can link additional wallets to their account
4. **Wallet Management** - Users can view and unlink wallets from the settings page
5. **Nonce Security** - Server-side nonce generation with expiration for replay protection
6. **Conditional Feature** - SIWE can be disabled via ENABLE_SIWE environment variable

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

| Method                         | Purpose                                        |
| ------------------------------ | ---------------------------------------------- |
| `siwe.nonce()`                 | Get nonce for SIWE message from server         |
| `SiweMessage.prepareMessage()` | Create EIP-4361 SIWE message (client-side)     |
| `siwe.verify()`                | Verify signature and authenticate/link account |
| `authClient.listAccounts()`    | List linked accounts including wallets         |
| `authClient.unlinkAccount()`   | Unlink a wallet from account                   |

---

### Technical Notes

1. **SIWE Message Creation**: The SIWE message is created client-side using the `siwe` package's `SiweMessage` class, following EIP-4361 standard format.

2. **Server Verification**: Uses viem's `verifyMessage` for cryptographic signature verification (recommended by BetterAuth docs).

3. **Account Linking**: Enabled via `accountLinking.enabled: true` in server config. When a logged-in user verifies a new wallet, it's automatically linked to their account.

4. **Nonce Management**: Server generates random nonces with 5-minute expiration stored in memory (production should use Redis/database).

---

### Next Steps (Phase 4: OIDC Provider)

According to the PRD, Phase 4 will add OIDC provider functionality:

- [ ] BetterAuth OIDC provider plugin
- [ ] OIDC client configuration via environment/YAML
- [ ] Consent screen implementation
- [ ] Discovery and token endpoints
