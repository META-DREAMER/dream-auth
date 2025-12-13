# Dream-Auth Deployment Summary

**Target Application:** `dream-auth` (Identity Provider & Forward Auth)
**Deployment Strategy:** HelmRelease (Chart: `bjw-s/app-template`)
**Target Namespace:** `auth` (recommended)

## 1. Container Specification
- **Image:** `ghcr.io/meta-dreamer/dream-auth:latest`
- **Port:** `3000` (HTTP)
- **Health Check:** `GET /api/health`
- **Security Context:** Runs as non-root user `1001:1001`. Read-only root filesystem recommended (mount `/tmp` if needed).

## 2. Configuration (Environment Variables)

### Secrets (Must be Encrypted via SOPS)
| Variable | Value / Description |
| :--- | :--- |
| `DATABASE_URL` | Postgres connection string (e.g., `postgres://user:pass@postgres-rw.database.svc:5432/dream_auth`) |
| `BETTER_AUTH_SECRET` | Min 32-char random string (used for signing tokens) |

### Application Config (ConfigMap / Plain Env)
| Variable | Value / Description |
| :--- | :--- |
| `BETTER_AUTH_URL` | `https://auth.${SECRET_DOMAIN}` |
| `COOKIE_DOMAIN` | `.${SECRET_DOMAIN}` (Note the leading dot) |
| `ENABLE_REGISTRATION` | `true` or `false` (controls public sign-up) |
| `ENABLE_PASSKEYS` | `true` (WebAuthn support) |
| `ENABLE_SIWE` | `true` (Ethereum Wallet support) |
| `ENABLE_OIDC_PROVIDER`| `true` (if OIDC is needed for Grafana, ArgoCD, etc.) |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses |
| `OIDC_CLIENTS_FILE` | `/config/oidc-clients.json` (if mounting OIDC config via file) |
| `NODE_ENV` | `production` |

## 3. OIDC Clients Configuration
**Method:** Mount a JSON file via ConfigMap/Secret to `/config/oidc-clients.json`.
**Format:**
```json
[
  {
    "clientId": "grafana",
    "clientSecret": "super-secret-value", 
    "redirectURLs": ["https://grafana.${SECRET_DOMAIN}/login/generic_oauth"],
    "name": "Grafana",
    "type": "web",
    "skipConsent": true
  }
]
```
*Note: If `clientSecret` is present, mount this file as a Secret, not a ConfigMap.*

## 4. Ingress & Forward Auth Integration
**Ingress Resource for Auth Server:**
- Host: `auth.${SECRET_DOMAIN}`
- TLS: Enabled (cert-manager)

**Forward Auth Annotation for Protected Apps:**
To protect *other* applications (e.g., `whoami`) using `dream-auth` as a middleware:
```yaml
nginx.ingress.kubernetes.io/auth-url: "http://dream-auth.auth.svc.cluster.local:3000/api/verify"
nginx.ingress.kubernetes.io/auth-signin: "https://auth.${SECRET_DOMAIN}/login?rd=$escaped_request_uri"
nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-User,X-Auth-Id,X-Auth-Email"
```

## 5. Dependencies
- **PostgreSQL:** Requires a running Postgres instance (e.g., via CloudNative-PG). Ensure the database `dream_auth` (or similar) exists.