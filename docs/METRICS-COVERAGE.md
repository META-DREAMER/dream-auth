# Metrics Instrumentation Coverage

Analysis of server-side metrics instrumentation in the dream-auth codebase.

**Date:** 2026-02-11
**Current state:** No structured metrics. Only `console.log` debug output exists.

## Summary

| Category | Operations | Instrumented | Coverage |
|----------|-----------|-------------|---------|
| Auth (BetterAuth) | 8 | 0 | 0% |
| OIDC Provider | 5 | 0 | 0% |
| Session / Forward-Auth | 2 | 0 | 0% |
| Database (direct queries) | 7 | 0 | 0% |
| Startup / Migrations | 3 | 0 | 0% |
| **Total** | **25** | **0** | **0%** |

No metrics, tracing, or observability libraries are installed. The only operational signals are unstructured `console.log` statements.

## Coverage Matrix

### Critical Priority — Auth Core

| Operation | File | Current Instrumentation | Recommended Metric | Type |
|-----------|------|------------------------|-------------------|------|
| Auth handler (all routes) | `src/routes/api/auth/$.ts` | None | `auth_requests_total{method, path, status}` | Counter |
| Auth handler latency | `src/routes/api/auth/$.ts` | None | `auth_request_duration_seconds{method, path}` | Histogram |
| User creation (signup) | `src/lib/auth.ts:102` | None | `auth_user_signups_total{provider}` | Counter |
| User creation blocked | `src/lib/auth.ts:119` | None | `auth_signup_blocked_total{reason}` | Counter |
| SIWE signature verification | `src/lib/auth.ts:220` | `console.error` on failure | `auth_siwe_verification_total{result}` | Counter |
| Email OTP sent | `src/lib/auth.ts:267` | `console.log` | `auth_email_otp_sent_total{type}` | Counter |
| Email verification sent | `src/lib/auth.ts:74` | `console.log` | `auth_email_verification_sent_total` | Counter |
| Invitation sent | `src/lib/auth.ts:327-351` | `console.log` | `auth_invitations_sent_total{type}` | Counter |

### Critical Priority — OIDC Provider

| Operation | File | Current Instrumentation | Recommended Metric | Type |
|-----------|------|------------------------|-------------------|------|
| OAuth2 proxy handler | `src/routes/oauth2/$.ts:46` | None | `oidc_requests_total{endpoint, method, status}` | Counter |
| OAuth2 proxy latency | `src/routes/oauth2/$.ts:46` | None | `oidc_request_duration_seconds{endpoint}` | Histogram |
| JSON-to-redirect conversion | `src/routes/oauth2/$.ts:79-89` | None | `oidc_redirects_total` | Counter |
| OIDC discovery endpoint | `src/routes/[.]well-known/openid-configuration.ts` | None | `oidc_discovery_requests_total{status}` | Counter |
| JWKS endpoint | `src/routes/[.]well-known/jwks[.]json.ts` | None | `oidc_jwks_requests_total{status}` | Counter |

### High Priority — Session / Forward-Auth

| Operation | File | Current Instrumentation | Recommended Metric | Type |
|-----------|------|------------------------|-------------------|------|
| Forward-auth verification | `src/routes/api/verify.ts` | None | `auth_verify_total{status}` | Counter |
| Session retrieval (SSR) | `src/lib/session.server.ts` | None | `auth_session_lookups_total{result}` | Counter |

### High Priority — OIDC Client Seeding

| Operation | File | Current Instrumentation | Recommended Metric | Type |
|-----------|------|------------------------|-------------------|------|
| Client seeding (total) | `src/lib/oidc/sync-oidc-clients.ts:168` | `console.log` | `oidc_client_seeding_total{result}` | Counter |
| Client upsert | `src/lib/oidc/sync-oidc-clients.ts:109` | None | `oidc_client_upserts_total{client_id}` | Counter |
| Seeding duration | `src/lib/oidc/sync-oidc-clients.ts:196` | None | `oidc_client_seeding_duration_seconds` | Histogram |
| Validation errors | `src/lib/oidc/sync-oidc-clients.ts:208` | None | `oidc_client_validation_errors_total` | Counter |

### High Priority — Startup / Migrations

| Operation | File | Current Instrumentation | Recommended Metric | Type |
|-----------|------|------------------------|-------------------|------|
| Migration run | `server/plugins/better-auth-auto-migrate.ts:170` | `console.log` with `Date.now()` timing | `auth_migrations_total{result}` | Counter |
| Migration duration | `server/plugins/better-auth-auto-migrate.ts:172` | `Date.now()` delta logged | `auth_migration_duration_seconds` | Histogram |
| Advisory lock wait | `server/plugins/better-auth-auto-migrate.ts:143` | `console.log` | `auth_migration_lock_wait_seconds` | Histogram |

### Medium Priority — Database Queries

| Operation | File:Line | Current Instrumentation | Recommended Metric | Type |
|-----------|-----------|------------------------|-------------------|------|
| Invitation lookup (signup gate) | `src/lib/auth.ts:108` | None | `db_query_duration_seconds{query="invitation_lookup"}` | Histogram |
| Groups claims fetch | `src/lib/auth.ts:179` | None | `db_query_duration_seconds{query="groups_claims"}` | Histogram |
| Account verification (SIWE) | `src/lib/auth.ts:303` | None | `db_query_duration_seconds{query="wallet_verification"}` | Histogram |
| Invitation preview (pre-auth) | `src/routes/invite.$id.tsx:80` | None | `db_query_duration_seconds{query="invitation_preview"}` | Histogram |
| Advisory lock acquire | `server/plugins/better-auth-auto-migrate.ts:39` | None | `db_query_duration_seconds{query="advisory_lock"}` | Histogram |
| Advisory lock release | `server/plugins/better-auth-auto-migrate.ts:182` | None | `db_query_duration_seconds{query="advisory_unlock"}` | Histogram |
| OIDC client upsert (DB) | `src/lib/oidc/sync-oidc-clients.ts:109` | None | `db_query_duration_seconds{query="oidc_upsert"}` | Histogram |

### Low Priority — Health

| Operation | File | Current Instrumentation | Recommended Metric | Type |
|-----------|------|------------------------|-------------------|------|
| Health check | `src/routes/api/health.ts` | None (returns timestamp) | `health_check_total` | Counter |

## Existing Console Logging (not metrics)

These `console.log` / `console.error` calls exist but are unstructured debug output, not metrics:

| File | Line(s) | Content |
|------|---------|---------|
| `src/lib/auth.ts` | 74-75 | Email verification URL |
| `src/lib/auth.ts` | 228 | SIWE verification failure |
| `src/lib/auth.ts` | 267 | Email OTP details (includes OTP in plaintext) |
| `src/lib/auth.ts` | 332-350 | Invitation details |
| `src/lib/oidc/sync-oidc-clients.ts` | 178, 198-199, 250, 256 | Seeding progress/errors |
| `server/plugins/better-auth-auto-migrate.ts` | 107-185 | Migration progress/timing |

**Security note:** `auth.ts:267` logs the OTP value. This should be removed or redacted before production.

## Recommended Implementation

### Library

[OpenTelemetry for Node.js](https://opentelemetry.io/docs/languages/js/) — industry standard, vendor-neutral, supports both metrics and tracing.

Key packages:
- `@opentelemetry/api` — API surface
- `@opentelemetry/sdk-node` — Auto-instrumentation SDK
- `@opentelemetry/exporter-prometheus` — Prometheus `/metrics` endpoint
- `@opentelemetry/instrumentation-pg` — Auto-instruments `pg` pool queries

### Integration Points

1. **Nitro plugin** (`server/plugins/metrics.ts`) — Initialize OpenTelemetry SDK at startup, expose `/metrics` endpoint
2. **Auth route middleware** — Wrap `auth.handler()` calls in `src/routes/api/auth/$.ts` and `src/routes/oauth2/$.ts` with request counting and latency histograms
3. **Database hooks** — Add histogram timers around direct `pool.query()` calls
4. **BetterAuth hooks** — Emit counters from existing `databaseHooks` and plugin callbacks (email, OTP, invitations)
5. **pg auto-instrumentation** — `@opentelemetry/instrumentation-pg` captures all pool queries automatically

### Metric Naming Conventions

Following [Prometheus naming best practices](https://prometheus.io/docs/practices/naming/):

- Prefix: `dreamauth_` (application namespace)
- Units in name: `_seconds`, `_total`, `_bytes`
- Labels for dimensions: `method`, `path`, `status`, `provider`, `result`
- Example: `dreamauth_auth_request_duration_seconds{method="POST",path="/sign-in/email",status="200"}`

### Priority Order

1. **Auth request counter + latency histogram** — Broadest visibility, covers all auth operations
2. **Forward-auth verify counter** — Critical for Kubernetes SSO monitoring
3. **OIDC endpoint counters** — Essential for SSO health
4. **Startup migration metrics** — Operational safety in multi-pod deployments
5. **Database query histograms** — Performance profiling (auto-instrumented by OTel `pg` plugin)
6. **Business event counters** (signups, OTPs, invitations) — Product analytics

### Gauges (Runtime)

| Metric | Description |
|--------|-------------|
| `dreamauth_pg_pool_total_count` | Total connections in pool |
| `dreamauth_pg_pool_idle_count` | Idle connections |
| `dreamauth_pg_pool_waiting_count` | Clients waiting for connection |
| `dreamauth_info{version}` | Application version info |

These can be collected via `pg.Pool` event listeners (`connect`, `acquire`, `remove`).

## Kubernetes Considerations

- Expose `/metrics` on the existing HTTP port (3000) or a dedicated metrics port
- Add Prometheus `ServiceMonitor` or `PodMonitor` CRD for auto-discovery
- The existing `/api/health` endpoint can be enhanced with readiness probe semantics (DB connectivity check)
- Advisory lock metrics are useful for detecting migration contention across replicas
