# Kubernetes Integration

## Forward Auth

**Endpoint:** `/api/verify` (`src/routes/api/verify.ts`)

| Condition | Response |
| --- | --- |
| Valid session | `200` + `X-Auth-Id`, `X-Auth-User`, `X-Auth-Email` |
| No session, expired session, deleted user | `401`, no identity headers |
| ... same, but `?mode=redirect` and the original request was `GET`/`HEAD` | `302` to `https://auth.example.com/login?redirect=<original url>` |
| Session lookup failed (e.g. database down) | `503`, no identity headers |

The endpoint serves two proxies that disagree about who does the sign-in
bounce, and `?mode=redirect` on the verify URL is how you tell it which one is
calling:

| | ingress-nginx `auth-url` | Traefik `forwardAuth` |
| --- | --- | --- |
| Verify URL | `/api/verify` | `/api/verify?mode=redirect` |
| On `401` | nginx redirects to `auth-signin` **and appends `?rd=<original url>` itself** | returns the `401` to the browser as-is: no redirect, no return-to |
| So dream-auth ... | returns a bare `401` and reads `rd` on `/login` | returns the `302` itself, rebuilding the original URL from `X-Forwarded-Proto/Host/Uri` |
| Original method | not consulted: nginx applies `auth-signin` to every method | `X-Forwarded-Method`; anything but `GET`/`HEAD` still gets a `401` |

Do not put `?mode=redirect` on an nginx `auth-url`: `auth_request` treats any
status other than 2xx, 401 and 403 as a backend error, so the `302` would turn
every logged-out request into a 500. The default mode is the nginx one because
it is the one where the wrong choice is loud.

Whichever proxy is in front, **`COOKIE_DOMAIN` must be set to the parent
domain** (e.g. `.example.com`). The return-to is validated against it (see
[Return-to validation](#return-to-validation)) and an unset cookie domain
rejects every cross-host bounce-back, leaving the user on the auth homepage
after sign-in.

### ingress-nginx

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

### Traefik v3

A `Middleware` per protected app (or one shared in the auth namespace and
referenced cross-namespace), attached to the app's `IngressRoute` or, for a
plain `Ingress`, via the
`traefik.ingress.kubernetes.io/router.middlewares: auth-dream-auth@kubernetescrd`
annotation:

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: dream-auth
  namespace: auth
spec:
  forwardAuth:
    address: "http://dream-auth.auth.svc.cluster.local:3000/api/verify?mode=redirect"
    authResponseHeaders:
      - X-Auth-Id
      - X-Auth-User
      - X-Auth-Email
    # Explicit either way: Traefik >= 3.6.14 warns when it is unset, and the
    # unset behaviour is inconsistent about which X-Forwarded-* it strips.
    trustForwardHeader: false
```

What Traefik does with that (`pkg/middlewares/auth/forward.go`):

- It issues its own `GET` to `address`, query string included - which is how
  `?mode=redirect` reaches us - and copies the client's request headers onto it
  (all of them by default, or only `authRequestHeaders` if you set that; if you
  do, `Cookie` must be in the list or nobody is ever logged in).
- It adds `X-Forwarded-Method`, `X-Forwarded-Proto`, `X-Forwarded-Host`,
  `X-Forwarded-Uri` and `X-Forwarded-For` describing the *original* request.
  `/api/verify` rebuilds the return-to from the middle three
  (`buildForwardedReturnTo` in `src/lib/forward-auth.ts`).
- A `2xx` lets the request through, with each `authResponseHeaders` name
  **deleted from the client's request and replaced** by the auth response's
  value - so a listed header is ours or absent, never the client's, same rule
  as nginx. Any status that is not `2xx` is returned to the client verbatim.
  There is no `authSigninURL`-style setting that would add a return-to for
  us, which is the whole reason `?mode=redirect` exists.

**`trustForwardHeader`.** With it `true`, Traefik copies the `X-Forwarded-*`
headers it *received* onto the auth request instead of deriving them from the
connection, so `X-Forwarded-Host` becomes whatever the previous hop said.
That is correct when the previous hop is a proxy you control (a Cloudflare
tunnel, a load balancer) *and* the entrypoint only accepts forwarded headers
from that hop: set `entryPoints.<name>.forwardedHeaders.trustedIPs` to its
addresses. The middleware-level option is deprecated since v3.6.14 in favour of
exactly that combination (entrypoint `trustedIPs` plus `trustForwardHeader:
true`). Without a trusted upstream, leave it `false` - and either way the
return-to is validated, so a spoofed `X-Forwarded-Host` costs the attacker a
redirect to `/`, not a phishing page.

**Do not set `trustForwardHeader` on the assumption it is harmless.** Even with
it `false`, `X-Forwarded-Host` is the `Host` the client sent, which on a
wildcard `HostRegexp` router is still client-chosen. The validator, not the
proxy, is what closes that.

### Return-to validation

Every return-to, whether it arrived as `?rd=` from nginx or was rebuilt from
`X-Forwarded-*` for Traefik, goes through `sanitizeRedirect`
(`src/lib/redirect/policy.ts`) before anything navigates: only same-origin paths
and `https://` URLs whose host is `COOKIE_DOMAIN` or a subdomain of it are
accepted, and everything else falls back to `/`. On the Traefik path that means
a hostile `X-Forwarded-Host` still produces a `302` to
`https://auth.example.com/login` - the user can sign in - but with no
`redirect` parameter, so they land on our homepage rather than the attacker's.
A `X-Forwarded-Uri` that is not a rooted path (`//evil.com`, `https:evil`) is
dropped before the URL is even assembled, keeping the host and returning the
user to the app root.

The pinning tests are `src/routes/api/verify.test.ts` (`?mode=redirect`) and
`src/lib/forward-auth.test.ts` (`buildForwardedReturnTo`).

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
