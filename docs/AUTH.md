# Authentication System (BetterAuth)

**Location:** `src/lib/auth.ts`

## Configuration

- **Database:** Uses PostgreSQL connection pool directly via `pg` (not Kysely ORM)
- **Plugins:** Order matters! `jwt()` must come before `oidcProvider()` for OIDC to work
- **OIDC Client Seeding:** `ensureOidcClientsSeeded()` is called at module load to seed clients from config into DB (see [OIDC.md](./OIDC.md))
- **Account Linking:** Enabled to allow users to link wallets/passkeys to existing email accounts
- **Cookie Caching:** Currently disabled due to TanStack Start SSR context issues (see comments in auth.ts)
- **Disabled Paths:** When OIDC is enabled, `/token` endpoint is disabled (OIDC uses `/oauth2/token`)

## TanStack Start Routing

Routes in `src/routes/` map to URLs.

**Key route patterns:**
- `_authed.tsx` - Layout route requiring authentication (child routes under `_authed/`)
- `__root.tsx` - Root layout with `<Outlet />` for all routes, loads session in `beforeLoad`
- `api/auth/$.ts` - Catch-all route for BetterAuth API (`/api/auth/*`)
- `oauth2/$.ts` - Catch-all for OIDC provider endpoints (`/oauth2/*`)
- `[.]well-known/` - OIDC discovery and JWKS endpoints (special syntax for dots in filenames)

## Session Loading

**Location:** `src/lib/session.server.ts`

```ts
export const getSessionFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const headers = getRequestHeaders();
    return auth.api.getSession({ headers });
  }
);
```

**Pitfall:** Don't call BetterAuth API endpoints directly in loaders. TanStack Start's SSR context is different from request context. Always use `createServerFn()`.

## Wagmi/Viem Integration (SIWE)

**Configuration:** `src/lib/wagmi.ts` defines chains and WalletConnect config

**Custom SimpleKit:** `src/components/simplekit/` - Lightweight wallet connection UI built on Wagmi
- Avoids external dependencies (RainbowKit, ConnectKit)
- Supports WalletConnect v2 for mobile wallets (if `VITE_WALLETCONNECT_PROJECT_ID` is set)
- Integrates with BetterAuth's SIWE flow

**SIWE Flow in BetterAuth** (`src/lib/auth.ts:148-201`):
- Generate nonce with `generateSiweNonce()` from `viem/siwe`
- Verify signature with `verifyMessage()` from `viem`
- Optional ENS lookup for name/avatar via `createPublicClient()`
