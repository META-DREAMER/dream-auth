# API Endpoints

## Route Architecture

TanStack Start file-based routing in `src/routes/`. Two handler patterns:

- **ServerRouteHandler:** Standard HTTP request/response (`src/routes/api/`)
- **Server Functions:** RPC-style calls via `createServerFn()` (used in page routes)

BetterAuth handles all `/api/auth/*` endpoints automatically via its plugin system.

## Custom Endpoints

### Health Check

**Endpoint:** `GET /api/health` (`src/routes/api/health.ts`)

```json
{ "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z" }
```

Used for Kubernetes liveness probes and Docker health checks.

### Forward Auth

**Endpoint:** `GET /api/verify` (`src/routes/api/verify.ts`)

Returns `200` with user headers or `401` for unauthorized. See [KUBERNETES.md](./KUBERNETES.md) for nginx config.

| Response Header | Value |
|----------------|-------|
| `X-Auth-User` | Display name |
| `X-Auth-Id` | User ID |
| `X-Auth-Email` | Email address |

### BetterAuth Handler

**Endpoint:** `GET|POST /api/auth/*` (`src/routes/api/auth/$.ts`)

Catch-all splat route delegating to `auth.handler(request)`. Ensures OIDC clients are seeded before processing. Covers all BetterAuth plugin endpoints:

- `/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/sign-out`
- `/api/auth/passkey/*` — WebAuthn registration/authentication
- `/api/auth/siwe/*` — SIWE nonce and verification
- `/api/auth/organization/*` — Organization CRUD, invitations, teams

### OAuth2 Proxy

**Endpoint:** `GET|POST /oauth2/*` (`src/routes/oauth2/$.ts`)

Proxies root-level OAuth2 requests to BetterAuth's internal `/api/auth/oauth2/*` paths. Provides OIDC-conformant URLs for external clients (Grafana, ArgoCD).

| Sub-path | Method | Purpose |
|----------|--------|---------|
| `/oauth2/authorize` | GET | Authorization (consent flow) |
| `/oauth2/token` | POST | Token exchange |
| `/oauth2/userinfo` | GET | User info |
| `/oauth2/consent` | POST | Consent submission |
| `/oauth2/endsession` | GET/POST | Session termination |

Converts BetterAuth JSON redirect responses to HTTP 302 redirects.

### OIDC Discovery

**Endpoint:** `GET /.well-known/openid-configuration` (`src/routes/[.]well-known/openid-configuration.ts`)

Proxies BetterAuth's discovery endpoint and rewrites all URLs to root-level paths (e.g., `authorization_endpoint` → `/oauth2/authorize`). Cached for 1 hour.

**Endpoint:** `GET|HEAD /.well-known/jwks.json` (`src/routes/[.]well-known/jwks[.]json.ts`)

JWKS endpoint for ID token verification. Cached with `must-revalidate`.

## Server Functions

### Session Loading

**Location:** `src/lib/session.server.ts`

```ts
export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  return auth.api.getSession({ headers });
});
```

Called in `__root.tsx` `beforeLoad` to hydrate session for all routes.

### Invitation Preview

**Location:** `src/routes/invite.$id.tsx`

```ts
const getInvitationPreview = createServerFn({ method: "GET" })
  .inputValidator((data: { invitationId: string }) => data)
  .handler(async ({ data }) => { /* direct DB query */ });
```

Returns invitation preview without authentication (exception to the "prefer `auth.api`" rule — pre-auth access needed).

## Route Protection

### Layout Routes

- `__root.tsx` — Root layout, loads session in `beforeLoad`
- `_authed.tsx` — Protected layout, redirects to `/login` if no session

```ts
// _authed.tsx pattern
beforeLoad: async ({ context, location }) => {
  if (!context.session) {
    throw redirect({ to: "/login", search: { redirect: location.href } });
  }
}
```

## Response Patterns

| Pattern | Example |
|---------|---------|
| JSON | `Response.json({ status: "ok" })` |
| Headers only | `new Response(null, { status: 200, headers: { ... } })` |
| Redirect | `new Response(null, { status: 302, headers: { Location: url } })` |
| BetterAuth passthrough | `auth.handler(request)` |

## Status Codes

| Code | Usage |
|------|-------|
| 200 | Success, forward-auth authorized |
| 302 | OIDC redirects, consent approved |
| 401 | Unauthorized (missing/invalid session) |
| 403 | Registration disabled without invitation |
