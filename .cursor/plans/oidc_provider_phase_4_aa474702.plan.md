---
name: OIDC Provider Phase 4
overview: Implement Phase 4 (OIDC Provider) from plan/prd.md so the auth server can act as an OpenID Connect provider for in-cluster apps (e.g. Immich, Grafana, ArgoCD). This plan explicitly addresses TanStack Start server routes, issuer/endpoints shape, consent UX, and OIDC hardening (PKCE, scopes/claims, and key management).
todos:
  - id: decide-issuer-and-endpoints
    content: Decide canonical issuer + endpoint shape (root vs /api/auth) and update PRD notes accordingly
    status: completed
  - id: add-oidc-provider-plugin
    content: Add better-auth OIDC provider plugin to src/lib/auth.ts with safe defaults (PKCE, scopes, issuer metadata)
    status: completed
  - id: add-jwt-signing-and-key-policy
    content: Add better-auth JWT plugin for JWKS + define signing key storage/rotation policy (k8s Secret, rotation/grace)
    status: completed
  - id: add-root-oidc-alias-server-routes
    content: Add TanStack Start server routes to expose root /.well-known/* and /oauth2/* (proxy/alias to BetterAuth base path)
    status: completed
  - id: add-oidc-client-plugin
    content: Add oidcClient plugin to src/lib/auth-client.ts (used by consent UI and any future internal OIDC client needs)
    status: completed
  - id: implement-consent-page
    content: Implement /consent page that renders validated client/scopes and submits consent via server-side handler (redirect using provider response)
    status: completed
  - id: add-oidc-config-loading
    content: Support OIDC client config via env AND mounted file (OIDC_CLIENTS or OIDC_CLIENTS_FILE), validate with Zod, fail fast
    status: completed
  - id: add-env-variables
    content: Add Phase 4 env vars to src/env.ts and document in .env.example
    status: completed
  - id: migrations-strategy
    content: Decide and document migration strategy for k8s/GitOps (initContainer/job/startup) and run BetterAuth migrations locally
    status: completed
  - id: add-integration-notes-for-immich
    content: Add example OIDC config snippets for Immich + Grafana + ArgoCD and document issuer/discovery URL expectations
    status: completed
  - id: validation-checklist
    content: Add a manual validation checklist (discovery, jwks, auth code flow) and a small scripted smoke check if feasible
    status: completed
  - id: update-worklog
    content: Document Phase 4 implementation decisions and steps in plan/worklog.md
    status: completed
---

# Phase 4: OIDC Provider Implementation (Updated)

## Goals (from `plan/prd.md`)

- Act as an **OIDC provider** for apps that require it (Grafana, ArgoCD, Immich, etc.)
- Support **Authorization Code flow** (and refresh tokens where supported)
- Support **static client registration** (config-driven)
- Provide **standard discovery endpoints** and **JWKS**
- Provide a **consent screen** (bypassable for trusted clients)

## Critical design decision: issuer + endpoint shape

TanStack Start currently mounts BetterAuth under `/api/auth/*` via a catch-all route.
BetterAuth’s OIDC provider endpoints are relative to that auth “base path” by default.

You need to pick one canonical model and implement it explicitly:

### Option A (Simplest): issuer includes base path

- **Issuer**: `https://auth.domain.com/api/auth`
- **Discovery**: `https://auth.domain.com/api/auth/.well-known/openid-configuration`
- **OAuth2 endpoints**: `https://auth.domain.com/api/auth/oauth2/*`

Pros:

- No proxy/alias routes needed
- Matches BetterAuth examples like `/api/auth/oauth2/register`

Cons:

- Some clients/admin UIs assume issuer is at domain root (usually OK, but surprises happen)

### Option B (PRD-compatible): root issuer + root endpoints (recommended for “drop-in IdP”)

- **Issuer**: `https://auth.domain.com`
- **Discovery**: `https://auth.domain.com/.well-known/openid-configuration`
- **OAuth2 endpoints**: `https://auth.domain.com/oauth2/*`

Implementation approach:

- Keep BetterAuth mounted at `/api/auth/*` (no need to change existing auth API)
- Add **TanStack Start server-route aliases** at root for:
- `/.well-known/openid-configuration`
- `/.well-known/jwks.json`
- `/oauth2/*`
- Each alias route forwards the request to the underlying BetterAuth route handler

This plan assumes **Option B**.
If you choose Option A instead, skip the alias-route work and update the PRD route table.

## OIDC hardening defaults (do these up front)

### 1) Require PKCE

Set `requirePKCE: true` in `oidcProvider`.
This makes “public client” misconfiguration less dangerous and aligns with modern OAuth guidance.

### 2) Explicit supported scopes

Declare supported scopes explicitly (start with):

- `openid`
- `profile`
- `email`
- `offline_access` (only if you intend to support refresh tokens for long-lived sessions)

### 3) Claims strategy (what apps actually need)

Define a minimal, stable set of claims:

- **`sub`**: stable user identifier (must not change)
- **`email`** / `email_verified` (if applicable)
- **`preferred_username`** (optional)

If you later need RBAC mapping (e.g. ArgoCD groups), plan for a `groups` claim sourced from:

- admin-managed roles in DB, OR
- an allowlist in config for a first version

BetterAuth supports adding additional claims via the OIDC provider configuration.

### 4) Signing keys + JWKS + rotation policy

If you enable JWT/JWKS for OIDC:

- Confirm `/token` is disabled (OAuth equivalent is `/oauth2/token`) per BetterAuth docs.
- Define where signing keys live so they survive pod restarts:
- **Minimum**: keys/secret material in a Kubernetes Secret
- **Preferred**: use BetterAuth-supported key rotation mechanisms and configure rotation + grace period

Document:

- rotation interval (e.g. 30–90 days)
- grace period (how long old keys remain valid)
- operational procedure (how you rotate in GitOps)

## TanStack Start implementation approach

TanStack Start “server routes” are files under `src/routes` that define a `server` property in `createFileRoute`. They’re the correct way to expose raw HTTP endpoints.

### 1) Keep BetterAuth mounted under `/api/auth/*`

- `src/routes/api/auth/$.ts` remains the main BetterAuth handler.
- OIDC provider endpoints will exist under `/api/auth/oauth2/*` and `/api/auth/.well-known/*`.

### 2) Add root alias server routes (Option B)

Add server routes that forward to the underlying BetterAuth handler.

Proposed file layout:

- `src/routes/[.]well-known/openid-configuration.ts`
- `src/routes/[.]well-known/jwks.json.ts`
- `src/routes/oauth2/$.ts`

Notes:

- TanStack Start supports escaped filename segments like `[.]well-known` for special paths.
- Each alias route should forward method, headers, and body to the internal BetterAuth endpoint and return the response (status + headers + body).

This makes PRD’s route table true without changing your existing BetterAuth base path.

### 3) Consent UX: use a server-side submit handler

BetterAuth’s consent endpoint (`POST /oauth2/consent`) returns a `redirectUrl`.

Implementation pattern:

- `/consent` page:
- Render client name + scopes, but **do not trust raw querystring** for display
- Prefer to validate `client_id` against trusted client config, and treat `scope` as informational only
- Consent submission:
- Prefer a TanStack Start **server function** or a small **server route action** that submits consent and then redirects to `redirectUrl`
- This avoids fragile client-side redirect logic and keeps cookie handling consistent

## Configuration model (GitOps-friendly)

Support both:

- **Env JSON**: `OIDC_CLIENTS='[...]'`
- **Mounted file**: `OIDC_CLIENTS_FILE=/config/auth.yaml`

Guidelines:

- Validate config with Zod at startup
- Fail fast on invalid JSON/YAML, invalid redirect URLs, or duplicate client IDs
- Never log client secrets

Client config should support at least:

- `clientId`
- `clientSecret`
- `name`
- `redirectURLs`
- `skipConsent`
- `disabled`
- optional metadata (logo URI, client URI)

## Environment variables (Phase 4)

Add to `src/env.ts` and `.env.example`:

- `ENABLE_OIDC_PROVIDER` (default: `false`)
- `OIDC_ISSUER` (default: `BETTER_AUTH_URL`; if using Option B, set to root URL)
- `OIDC_REQUIRE_PKCE` (default: `true`)
- `OIDC_CLIENTS` (optional JSON string)
- `OIDC_CLIENTS_FILE` (optional file path)
- `OIDC_EXPOSE_ROOT_ALIASES` (default: `true` if Option B; `false` if Option A)

(Keep the rest of the existing required env vars: `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, DB vars, cookie domain, etc.)

## Database migrations

BetterAuth OIDC provider adds OAuth/OIDC tables.

Local dev:

- Run BetterAuth migrations (CLI)

Kubernetes/GitOps:

- Decide one:
- **initContainer** that runs migrations before app starts
- **pre-install/upgrade Helm hook job**
- **startup migration** in app (discouraged unless you handle concurrency carefully)

Document the chosen method and ensure it’s safe for rollouts.

## Integration notes (k8s apps)

### Immich

Add a section with:

- which URL Immich expects as issuer/discovery
- required scopes (typically `openid profile email`)
- where to configure redirect URI (from Immich) and how to map it into `OIDC_CLIENTS`

### Grafana

Keep your existing example but clarify issuer/discovery:

- If Option B: set Grafana’s discovery/issuer to root
- If Option A: issuer includes `/api/auth`

### ArgoCD

Add:

- redirect URI format for ArgoCD
- note about group claims if you plan to use RBAC

## Validation checklist (manual)

- **Discovery**: `GET /.well-known/openid-configuration` returns correct issuer + endpoints
- **JWKS**: `GET /.well-known/jwks.json` returns valid key set
- **Auth code flow**:
- authorize → login → consent → redirect back with `code`
- token exchange succeeds
- userinfo returns expected claims
- **PKCE**:
- public client with PKCE required works
- missing/invalid PKCE fails
- **Consent**:
- skipConsent clients bypass
- deny returns appropriate error/redirect

Optionally add a small scripted smoke check (curl + a tiny node script) for discovery/JWKS.

## Implementation steps (ordered)

1. **Decide issuer shape** (Option A vs B)
2. Add OIDC provider plugin config + secure defaults (PKCE, scopes, claims)
3. Add JWT/JWKS signing strategy + key storage/rotation plan
4. Add root alias server routes (if Option B)
5. Implement consent page + server-side consent submit/redirect
6. Add config loading (env + file) and validation
7. Run migrations and codify the k8s migration approach
8. Document Immich/Grafana/ArgoCD examples
9. Run validation checklist; record results in `plan/worklog.md`
