# Authentication System (BetterAuth)

**Location:** `src/lib/auth.ts`

## Configuration

- **Database:** Uses PostgreSQL connection pool directly via `pg` (not Kysely ORM)
- **Plugins:** Order matters! `jwt()` must come before `oauthProvider()` for OIDC to work, and `tanstackStartCookies()` must be last
- **OIDC Client Seeding:** `ensureOidcClientsSeeded()` (`src/lib/oidc/sync-oidc-clients.ts`) is *not* called from `auth.ts`. It runs from the nitro startup plugin (`seedOidcClientsIfEnabled` in `server/plugins/better-auth-auto-migrate.ts`, after migrations so the `oauthClient` table exists) and again, guarded by a module-level `oidcReady` flag, on the first request through the BetterAuth catch-all route (`ensureOidcReady` in `src/routes/api/auth/$.ts`). Both are no-ops when `ENABLE_OIDC_PROVIDER` is false. See [OIDC.md](./OIDC.md)
- **Account Linking:** Enabled to allow users to link wallets/passkeys to existing email accounts
- **Cookie Caching:** Currently disabled due to TanStack Start SSR context issues (see comments on the `session` option in `auth.ts`)
- **Trusted Origins:** `trustedOrigins` is the auth origin plus, when `COOKIE_DOMAIN` is set, the cookie domain and its subdomains. The redirect validator (`src/lib/redirect/policy.ts`) derives its allow-list from the same pair, so a host that may drive the auth endpoints is also a legal post-login bounce-back target - and nothing else is
- **Cross-subdomain cookies:** the `advanced.cookies` block that would apply `COOKIE_DOMAIN` to the session cookie is commented out. `COOKIE_DOMAIN` currently only widens `trustedOrigins` and the redirect allow-list; the session cookie itself stays on the auth origin. Forward auth for sibling hosts needs that block enabled
- **Client IP:** `advanced.ipAddress.ipAddressHeaders` comes from `TRUSTED_CLIENT_IP_HEADERS` via `src/lib/client-ip.ts`. It keys the rate limiter and the session `ipAddress` column. Behind the Cloudflare tunnel it must be `cf-connecting-ip,x-forwarded-for`; the threat model, the measured header table and the LAN residual risk are in [KUBERNETES.md](./KUBERNETES.md#client-ip-for-rate-limiting)
- **Disabled Paths:** When OIDC is enabled, `/token` endpoint is disabled (OIDC uses `/oauth2/token`)

## TanStack Start Routing

Routes in `src/routes/` map to URLs.

**Key route patterns:**
- `_authed.tsx` - Layout route requiring authentication (child routes under `_authed/`)
- `__root.tsx` - Root layout with `<Outlet />` for all routes, loads session in `beforeLoad`
- `api/auth/$.ts` - Catch-all route for BetterAuth API (`/api/auth/*`)
- `oauth2/$.ts` - Catch-all for OIDC provider endpoints (`/oauth2/*`)
- `[.]well-known/` - OIDC discovery and JWKS endpoints (special syntax for dots in filenames)

## Redirect Safety

Any parameter that decides where a user lands after signing in is
attacker-controlled. `/login` and `/register` accept `redirect` (ours) and `rd`
(the ingress-nginx convention) and put both through `sanitizeRedirect`
(`src/lib/redirect/policy.ts`) before anything navigates.

The allow-list is the auth origin plus, when `COOKIE_DOMAIN` is set, that domain
and its subdomains - the same set as `trustedOrigins`. Everything else, including
protocol-relative URLs, `javascript:`, embedded credentials and backslash tricks,
falls back to `/`.

`beforeLoad` resolves the target once and puts it in route context, so the
handlers stay synchronous. Never read `Route.useSearch().redirect` directly; use
`Route.useRouteContext().safeRedirect`.

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

**SIWE Flow in BetterAuth** (the `siwe()` plugin entry in the `plugins` array of `src/lib/auth.ts`):
- Generate nonce with `generateSiweNonce()` from `viem/siwe`
- Verify signature with `verifyMessage()` from `viem`
- Optional ENS lookup for name/avatar via `createPublicClient()`

## Passkeys and the `@peculiar/asn1-schema` override

`pnpm.overrides` in `package.json` pins `@peculiar/asn1-schema` to a single
version. Keep it.

`@simplewebauthn/server` (via `@better-auth/passkey`) verifies ES256 assertions
by parsing the DER signature with `AsnParser.parse(sig, ECDSASigValue)`.
`ECDSASigValue` comes from `@peculiar/asn1-ecc`, which registers its schema
through class decorators into a module-level singleton inside
`@peculiar/asn1-schema`. If pnpm resolves two copies of `asn1-schema` (which
it did: `@simplewebauthn/server` took 2.6.0, `asn1-ecc` took 2.9.5), the
decorator writes to one singleton and the parser reads the other, and every
passkey sign-in fails with `Cannot get schema for 'ECDSASigValue' target`.
Registration is unaffected because `fmt: "none"` attestations never touch
ASN.1.

The bug lives in dependency resolution, so `scripts/check-passkey-bundle.mjs`
runs as part of `pnpm build` against the built `.output/server` chunks, not the
source: it asserts one `AsnSchemaStorage` instance in the bundle and verifies a
synthetic ES256 registration and assertion through the built
`@simplewebauthn/server` chunk.
