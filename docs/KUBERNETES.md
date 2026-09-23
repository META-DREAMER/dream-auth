# Kubernetes Integration

## Forward Auth

**Endpoint:** `/api/verify` (`src/routes/api/verify.ts`)

| Condition | Response |
| --- | --- |
| Valid session, authorized (see [Authorization](#authorization)) | `200` + `X-Auth-Id`, `X-Auth-User`, `X-Auth-Email`, `X-Auth-Groups` |
| No session, expired session, deleted user | `401`, no identity headers |
| ... same, but `?mode=redirect` and the original request was `GET`/`HEAD` | `302` to `https://auth.example.com/login?redirect=<original url>` |
| Valid session, **not** authorized | `403`, no identity headers |
| ... same, but `?mode=redirect` and the original request was `GET`/`HEAD` | `302` to `https://auth.example.com/forbidden?redirect=<original url>` |
| Session or membership lookup failed (e.g. database down) | `503`, no identity headers |

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
  nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Id,X-Auth-User,X-Auth-Email,X-Auth-Groups"
```

For a team- or role-gated app, add the parameter to `auth-url` (it is the
only place these parameters are read from - see
[Authorization](#authorization)):

```yaml
  nginx.ingress.kubernetes.io/auth-url: "http://dream-auth.auth.svc.cluster.local:3000/api/verify?team=media"
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

One `Middleware` per **access level**, shared and referenced cross-namespace
from each app's `IngressRoute` or, for a plain `Ingress`, via the
`traefik.ingress.kubernetes.io/router.middlewares: auth-dream-auth@kubernetescrd`
annotation. The access level is the query string on `address`, and nothing
else (see [Authorization](#authorization)).

The `auth` namespace below is an example. A deployment may keep its
Middlewares wherever its other Traefik objects live - `networking`, say - and
the reference is always `<namespace>-<name>@kubernetescrd`, so that becomes
`networking-dream-auth-media@kubernetescrd`. The `address` does not change:
it names the dream-auth Service, not the Middleware's namespace.

```yaml
# Any member of the organization in FORWARD_AUTH_ORG_ID.
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
      - X-Auth-Groups
    # Explicit either way: Traefik >= 3.6.14 warns when it is unset, and the
    # unset behaviour is inconsistent about which X-Forwarded-* it strips.
    trustForwardHeader: false
---
# Members of the "media" team, plus owners and admins.
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: dream-auth-media
  namespace: auth
spec:
  forwardAuth:
    address: "http://dream-auth.auth.svc.cluster.local:3000/api/verify?mode=redirect&team=media"
    authResponseHeaders:
      - X-Auth-Id
      - X-Auth-User
      - X-Auth-Email
      - X-Auth-Groups
    trustForwardHeader: false
---
# Owners and admins only.
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: dream-auth-admin
  namespace: auth
spec:
  forwardAuth:
    address: "http://dream-auth.auth.svc.cluster.local:3000/api/verify?mode=redirect&role=admin"
    authResponseHeaders:
      - X-Auth-Id
      - X-Auth-User
      - X-Auth-Email
      - X-Auth-Groups
    trustForwardHeader: false
```

Attach `auth-dream-auth-media@kubernetescrd` to the photo app,
`auth-dream-auth-admin@kubernetescrd` to the dashboards, and plain
`auth-dream-auth@kubernetescrd` to everything else. A new team means a new
Middleware with `&team=<name>`; nothing in dream-auth changes.

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

### Authorization

Authentication answers "who is this"; authorization answers "may they reach
*this* app". `/api/verify` does both, and the second is configured in exactly
two places: one environment variable and the query string of each proxy's
verify URL.

**`FORWARD_AUTH_ORG_ID`** names the single organization whose membership
counts, by **id**. Copy it from the organization's settings page in the UI.
It is never a slug: any user who can create an organization chooses its
slug, so a slug-keyed check would let them mint their own `home`. (Org
creation is restricted too - see `docs/ORGANIZATION.md` - but the id check
does not depend on that.)

**Unset**, the endpoint behaves exactly as it did before authorization
existed: any signed-in user gets `200`. A warning is logged at startup. This
is what makes the rollout safe - see [Rollout](#rollout).

**The verify URL** carries the requirement for the app. Traefik copies the
middleware's `address` onto the auth subrequest verbatim, and nginx does the
same with `auth-url`, so these parameters are set by whoever writes the
cluster manifests and by nobody else:

| Verify URL | Who passes |
| --- | --- |
| `/api/verify?mode=redirect` | any member of the org (owner, admin or member) |
| `/api/verify?mode=redirect&team=media` | owners, admins, and members of the team named `media` |
| `/api/verify?mode=redirect&role=admin` | owners and admins |

Rules:

- `team=` is matched against the org's team names **case-insensitively and
  exactly**: `team=media` accepts a team called `Media`, not `media-2`. Team
  names are not unique, so if both `Media` and `media` exist, membership of
  either passes.
- A member may hold several roles (`admin,member`); owner or admin among
  them counts as elevated, and `X-Auth-Groups` lists each role separately.
- A `team=` that names **no team in the org** is a deny for members, logged
  with the missing name (`[ForwardAuth] denied user ... team "photos" does
  not exist`). Owners and admins still pass, so a typo in a middleware
  cannot lock the person who can fix it out.
- Any other `role=` value, an empty `team=`, or both parameters at once is a
  deny for everyone. Present-but-wrong fails closed.
- With a requirement on the verify URL but **no `FORWARD_AUTH_ORG_ID`**, the
  request is denied: "cannot evaluate" never reads as "allowed".

**What is *not* consulted:** the client's request. `X-Forwarded-Uri` is the
URL the user asked for, and `?team=media` or `&role=admin` on it changes
nothing - `src/routes/api/verify.test.ts` pins that, along with the rest of
the matrix. The `X-Forwarded-*` headers are read only to build the return-to
for the `302`s, and go through the same validator as before.

**Responses.** Signed out is unchanged. Signed in but not authorized is a
bare `403` - or, when the verify URL has `?mode=redirect` and the original
request was a `GET`/`HEAD`, a `302` to
`https://auth.example.com/forbidden?redirect=<original url>`. That page says
the account does not have access, shows who is signed in, and offers to sign
out and switch accounts, returning to the app afterwards. The `redirect`
value is the sanitized return-to (same policy as `/login`), so a hostile
`X-Forwarded-Host` produces `/forbidden` with no parameter, never a reflected
host. nginx's `auth_request` treats `403` as a deny, so no `mode` is needed
there.

**`X-Auth-Groups`** is added to the `200` for the pinned org:
`role:<role>` and one `team:<name>` per team the user is in, comma-separated,
each entry sanitized to printable ASCII with commas stripped (e.g.
`role:member,team:media`). Empty in legacy mode, which both proxies turn into
"header absent". Downstream apps that want finer distinctions than the
middleware makes can read it; like `X-Auth-User` it is derived from
user-editable names, so authorize on `X-Auth-Id` and treat groups as a
hint. It must be listed in `authResponseHeaders` / `auth-response-headers`
like the others, or the client's own copy passes through.

**Caching.** The membership lookup (one indexed query over `member`, `team`
and `teamMember`; `src/lib/org-access.ts`) is cached in-process for
**30 seconds per user and org** (`src/lib/forward-auth-authz.ts`), because
this endpoint runs on every request to every protected app. The trade-off:
**revoking access takes effect within 30 seconds on each replica**, not
instantly. Removing a user from a team or the org keeps working for that
long; signing them out or deleting the user is immediate, because the
session check runs first and is never cached. Denials are cached too, so a
freshly granted user may also wait up to 30 seconds.

### Rollout

The pieces are independent, and the order below means each step is a no-op
until the next one:

1. **Deploy the image.** Without `FORWARD_AUTH_ORG_ID` nothing changes; the
   pod logs `FORWARD_AUTH_ORG_ID is not set` at startup.
2. **Set `FORWARD_AUTH_ORG_ID`** (from the org settings page) on the
   Deployment. Existing middlewares - all `?mode=redirect` with no
   requirement - now admit members of that org only. Everyone who should
   have access must already be a member: invite them first.
3. **Add the `dream-auth-media` / `dream-auth-admin` middlewares** and attach
   them to the apps that need them.
4. **Audit existing organizations.** The org-creation restriction only
   applies from this release on: anyone who already owns an organization
   keeps the ability to create more, and any org created earlier still
   contributes its slug to the OIDC `groups` claim. List what exists and
   delete the strays (owner -> Settings -> Delete Organization, or by row):

   ```sql
   SELECT o.slug, m.role, u.email
   FROM member m
   JOIN organization o ON o.id = m."organizationId"
   JOIN "user" u ON u.id = m."userId"
   ORDER BY o.slug, m.role, u.email;
   ```

   Expect exactly the pinned organization and its members. Anything else is
   either intended or a stray.

Going backwards works the same way: detach the middlewares, unset the
variable, roll back the image.

### Authorizing on identity

Key downstream authorization on **`X-Auth-Id`**, not `X-Auth-Email`.

`X-Auth-Id` is the Better Auth user id: opaque, immutable, and unique for the
life of the account. `X-Auth-Email` is mutable (a user can change it) and is
reused - deleting an account frees the address for the next person to register,
so an email-keyed ACL silently transfers to whoever claims it next. The tradeoff
is legibility: `X-Auth-Id` means nothing in a log or an ACL without a lookup, so
keep `X-Auth-Email` for display and audit, and key on `X-Auth-Id`.

`X-Auth-User` is a display name. It is user-controlled, so it is stripped to
printable ASCII before it is emitted - never authorize on it. `X-Auth-Groups`
carries team names, which admins choose, and gets the same treatment.

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
