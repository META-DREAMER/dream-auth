# Kubernetes Integration

## Forward Auth

**Endpoint:** `/api/verify` (`src/routes/api/verify.ts`)

| Condition | Response |
| --- | --- |
| Valid session | `200` + `X-Auth-Id`, `X-Auth-User`, `X-Auth-Email` |
| No session, expired session, deleted user | `401`, no identity headers |
| Session lookup failed (e.g. database down) | `503`, no identity headers |

nginx turns the `401` into a redirect to `auth-signin`; the `503` denies the
request outright, so an outage never reads as "authenticated".

### Annotations

Copy-pasteable, and safe as written:

```yaml
annotations:
  nginx.ingress.kubernetes.io/auth-url: "http://dream-auth.auth.svc.cluster.local:3000/api/verify"
  nginx.ingress.kubernetes.io/auth-signin: "https://auth.example.com/login"
  nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Id,X-Auth-User,X-Auth-Email"
```

**`auth-signin` carries no query string, and that is deliberate.** When the
signin URL has no query of its own, ingress-nginx appends the bounce-back
parameter itself (`buildAuthSignURL` in
`internal/ingress/controller/template/template.go`):

```
return 302 https://auth.example.com/login?rd=$pass_access_scheme://$http_host$escaped_request_uri;
```

That is an **absolute** URL back to the app the user asked for, which is the
only thing that can work across subdomains. If you write the query yourself -
the `?rd=$escaped_request_uri` that older versions of this doc suggested - the
controller uses your value verbatim, and `$escaped_request_uri` is only the
escaped *path and query*. The user lands on `https://auth.example.com/dashboard`
instead of `https://app.example.com/dashboard`: a 404 on the IdP, and the app
they wanted is never reached.

The parameter name defaults to `rd`. To use this app's native spelling instead:

```yaml
  nginx.ingress.kubernetes.io/auth-signin-redirect-param: "redirect"
```

The login and register pages accept both `rd` and `redirect`, with `redirect`
winning when both are present, so either annotation works and neither needs a
code change.

Whatever the parameter is called, its value is validated before anything
navigates (`sanitizeRedirect` in `src/lib/redirect/policy.ts`): only same-origin
paths and `https://` URLs under `COOKIE_DOMAIN` are accepted, and everything
else falls back to `/`. Which means **`COOKIE_DOMAIN` must be set to the parent
domain** (e.g. `.example.com`) or the bounce-back to `app.example.com` is
rejected and the user is left on the auth homepage.

### Why these headers cannot be spoofed

For each name in `auth-response-headers`, ingress-nginx generates this in the
protected location (`buildAuthResponseHeaders` in
`internal/ingress/controller/template/template.go`):

```nginx
auth_request_set $authHeader0 $upstream_http_x_auth_id;
proxy_set_header 'X-Auth-Id' $authHeader0;
```

Two nginx behaviours make that safe:

1. A header name that appears in a `proxy_set_header` is **removed from the
   client's own request** before it is proxied - nginx skips inbound headers
   whose name is in the proxy headers hash, regardless of the value.
2. A `proxy_set_header` with an **empty value is not sent at all**. So if
   `/api/verify` ever returns `200` without `X-Auth-Id`, the upstream sees no
   such header rather than an empty or attacker-supplied one.

Together: a listed header is either the value this server produced, or absent.
It is never client-controlled. That is the whole mechanism - no signing or HMAC
scheme is needed, and adding one would only hide the real rule.

### What is *not* protected

- **Any `X-Auth-*` header you do not list is passed straight through from the
  client.** `proxy_pass_request_headers` is on for the protected location and
  only the listed names are scrubbed. If an app behind this trusts, say,
  `X-Auth-Admin` or `X-Forwarded-User`, a client can simply send it. There is no
  first-class annotation that strips arbitrary inbound headers, and the snippet
  annotations that could (`configuration-snippet` with `proxy_set_header
  X-Auth-Admin "";`, or `more_clear_input_headers`) are disabled by default
  since ingress-nginx v1.9: `allow-snippet-annotations` defaults to `false` and
  `configuration-snippet` is classified `AnnotationRiskCritical`, above the
  default `annotations-risk-level: High`.
  **The rule: downstream apps must trust exactly the names in
  `auth-response-headers`, and nothing else.**
- **The auth subrequest receives the client's original headers**
  (`proxy_pass_request_headers on;` in the generated
  `location = /_external-auth-...` block). `/api/verify` therefore sees
  client-supplied `X-Auth-*` and must never reflect them - it builds every
  header from the session alone (`src/lib/forward-auth.ts`), and
  `src/routes/api/verify.test.ts` pins that.
- **`auth-keepalive` is not recommended with `auth-response-headers`.** It
  switches the controller to a Lua implementation whose `$authHeader` indices
  appear to be 1-based while the template declares them 0-based. Unverified at
  runtime, but there is no upstream test asserting forwarded header *values* on
  that path, so leave `auth-keepalive` at its default until you have tested it.
- Keep the controller patched: `CVE-2026-1580` is a config injection through
  the sibling `auth-method` annotation (fixed in v1.13.7 / v1.14.3).

### Authorizing on identity

Key downstream authorization on **`X-Auth-Id`**, not `X-Auth-Email`.

`X-Auth-Id` is the Better Auth user id: opaque, immutable, and unique for the
life of the account. `X-Auth-Email` is mutable (a user can change it) and is
reused - deleting an account frees the address for the next person to register,
so an email-keyed ACL silently transfers to whoever claims it next. The tradeoff
is legibility: `X-Auth-Id` means nothing in a log or an ACL without a lookup, so
keep `X-Auth-Email` for display and audit, and key on `X-Auth-Id`.

`X-Auth-User` is a display name. It is user-controlled, so it is stripped to
printable ASCII before it is emitted - never authorize on it.

## Client IP for rate limiting

**Config:** `TRUSTED_CLIENT_IP_HEADERS`, wired in `src/lib/client-ip.ts` into
better-auth's `advanced.ipAddress.ipAddressHeaders`. The rate limiter and the
session's `ipAddress` column both read the result.

better-auth walks the listed headers in order and takes the first that holds
exactly one valid address. A comma-separated chain is rejected unless
`advanced.ipAddress.trustedProxies` is set (it is not, see below), and an
unresolvable IP lands every request in one shared per-path bucket - the
fallback that upstream introduced in 1.6.17 / 1.6.21 in place of trusting the
left-most `X-Forwarded-For` entry, which a client controls.

### What the pod receives

Measured, not inferred: a request into ingress-nginx from a peer that is not in
`set_real_ip_from`, carrying forged `X-Forwarded-For`, `CF-Connecting-IP`,
`X-Real-IP` and `True-Client-IP`, echoed by a pod behind it.

| Header                     | At the pod                                      |
| -------------------------- | ----------------------------------------------- |
| `X-Forwarded-For`          | overwritten with the ingress's peer address     |
| `X-Real-IP`                | overwritten with the ingress's peer address     |
| `X-Original-Forwarded-For` | copy of the inbound `CF-Connecting-IP`          |
| `CF-Connecting-IP`         | passed through as sent                          |
| `True-Client-IP`           | passed through as sent                          |

The controller runs `real_ip_header CF-Connecting-IP` with `set_real_ip_from`
limited to Cloudflare's published ranges. `cloudflared` runs in-cluster, so on
the tunnel path the peer is a pod address that is not in that list, the real-ip
module never fires, and `X-Forwarded-For` at the pod is cloudflared's own IP for
every visitor. That is why the default `x-forwarded-for` collapses tunnel
traffic into one bucket - not into the `no-trusted-ip` bucket, but into
cloudflared's, which is no better.

### The decision

```
TRUSTED_CLIENT_IP_HEADERS=cf-connecting-ip,x-forwarded-for
```

- **`cf-connecting-ip` first.** On the tunnel path it is the only header that
  carries the visitor, and it cannot be forged there: Cloudflare's edge sets it
  on every request it proxies, and the tunnel is only reachable through the
  edge. Cloudflare also recommends it over `X-Forwarded-For` for exactly this
  reason - one address, consistent format.
- **`x-forwarded-for` last.** It is never client-controlled (the ingress
  overwrites it on every path), so it is a safe fallback for traffic that did
  not cross Cloudflare, chiefly LAN clients hitting the load-balancer address.
  Listed *first* it would shadow `cf-connecting-ip`, because the ingress always
  sets it; startup warns on that order.
- **Not `true-client-ip`.** Cloudflare only adds it through an Enterprise
  managed transform. On any other plan it is whatever the visitor sent.
- **Not `trustedProxies`.** It would let better-auth walk a chain from the
  right, but the ingress does not produce a chain (`compute-full-forwarded-for`
  is off), and turning that on plus pinning the pod CIDR is a cluster change
  that the Traefik migration would have to redo.

### Residual risk: the LAN path

Nothing between a LAN client and the ingress strips `CF-Connecting-IP`, so a
client that reaches the load-balancer address directly can forge it and pick
its own rate-limit bucket, or exhaust a specific remote address's bucket. This
is accepted: the LAN (and the WireGuard network that lands on it) is already a
trusted boundary with direct reach to every cluster service. Closing it means
the ingress dropping inbound `CF-Connecting-IP` unless the peer is cloudflared.
ingress-nginx cannot express that without a snippet annotation; Traefik can,
with a `headers` middleware behind an `ipAllowList`.

### Unresolvable IPs

better-auth 1.7.5 offers no per-request choice here: an unresolvable IP goes
to the shared `no-trusted-ip` bucket, or `disableIpTracking` switches rate
limiting off for everyone. The shared bucket fails closed, so it stays. With
`x-forwarded-for` as the last resort, only traffic that never crossed the
ingress (in-cluster callers) or that presents a forwarded chain the ingress
never produces can reach it.

### After the Traefik migration

The decision holds only while the ingress keeps two properties. Re-run the
echo probe once `dream-auth` moves to the `traefik` class and confirm:

1. `X-Forwarded-For` at the pod is still a single, peer-set value. Traefik does
   this by default; it stops doing it for any peer listed in
   `forwardedHeaders.trustedIPs`, so that list must never include the pod CIDR
   or the LAN. Cloudflare's public ranges are fine - cloudflared is not in them.
2. `CF-Connecting-IP` still passes through untouched. No `headers` middleware
   may rewrite or strip it on the tunnel path.

If either changes, `src/lib/client-ip.ts` and this section are wrong together.

## Auto-Migrations System

**Location:** `server/plugins/better-auth-auto-migrate.ts` (Nitro startup plugin)

Safe for Kubernetes multi-replica deployments:

- **PostgreSQL Advisory Lock:** Uses `pg_try_advisory_lock(hashtext($1))` to ensure only one pod runs migrations at a time
- **Double-Check Pattern:** Checks for pending migrations before acquiring lock (avoids contention when up-to-date), then re-checks after acquiring lock (in case another pod ran them)
- **Additive-Only:** Better Auth never drops columns/tables
- **Detailed Logging:** Shows exactly what tables/columns will be created (GitOps audit trail)

### Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `BETTER_AUTH_AUTO_MIGRATE` | `false` | Enable auto-migrations |
| `BETTER_AUTH_MIGRATION_LOCK_KEY` | - | Custom lock key for multiple deployments on same DB |
| `BETTER_AUTH_MIGRATION_LOCK_TIMEOUT_MS` | `600000` | Lock timeout (10 minutes) |

### Vite Config Requirement

The Nitro plugin must be included in `vite.config.ts`:

```ts
nitro({
  preset: 'node-server',
  plugins: ['server/plugins/better-auth-auto-migrate.ts'],
}),
```

## Docker Deployment

Multi-stage build (see `Dockerfile`):

- **Builder stage:** Node 22 Alpine with pnpm
- **Runner stage:** Node 22 Alpine (not Bun - ESM compatibility)
- **Health check:** `/api/health` endpoint

Run locally: `docker-compose up -d` (includes PostgreSQL)

Set `SKIP_ENV_VALIDATION=true` in Dockerfile for builds.
