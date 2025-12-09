# Product Requirements Document (PRD)

## Auth Server — Home Cluster Identity Provider

---

## Document Info

| Field                 | Value                          |
| --------------------- | ------------------------------ |
| **Project Name**      | Auth Server                    |
| **Repository**        | `github.com/<org>/auth-server` |
| **Version**           | 1.0.0                          |
| **Status**            | Draft                          |
| **Target Deployment** | Kubernetes (via GitOps)        |

---

## 1. Executive Summary

### 1.1 Purpose

Build a lightweight, self-hosted identity provider that serves as the central authentication system for a home Kubernetes cluster. The auth server will replace the need for heavier solutions like Authentik or Authelia while providing modern authentication methods including passkeys and Ethereum wallet authentication (SIWE).

### 1.2 Goals

1. **Modern Authentication**: Support passwordless authentication via passkeys (WebAuthn/FIDO2) and Sign-In With Ethereum (SIWE)
2. **Lightweight**: Minimal resource footprint suitable for home lab infrastructure
3. **Kubernetes-Native**: Designed for forward-auth integration with ingress controllers
4. **Self-Contained**: Single container deployment with no external dependencies beyond a database
5. **GitOps Compatible**: Configuration-driven with environment variables and mounted config files

### 1.3 Non-Goals

- Enterprise SSO features (SAML, SCIM provisioning)
- Multi-tenant architecture
- High-availability clustering (single replica is acceptable)
- Mobile native SDKs

---

## 2. Background & Context

### 2.1 Problem Statement

Home Kubernetes clusters often require authentication for self-hosted applications (media servers, automation tools, dashboards). Current solutions fall into two categories:

1. **Heavy IdPs** (Authentik, Keycloak): Resource-intensive (1-2GB RAM), complex configuration, overkill for home use
2. **Lightweight proxies** (Authelia): Limited extensibility, no support for modern auth methods like Ethereum wallets

Neither category supports the combination of passkeys AND Ethereum wallet authentication while remaining lightweight.

### 2.2 Solution Overview

A custom auth server built on TanStack Start that:

- Acts as an identity provider with a built-in login UI
- Exposes a forward-auth endpoint for Kubernetes ingress controllers
- Optionally serves as an OIDC provider for applications that require it
- Runs in a single container with ~100-200MB RAM footprint

---

## 3. User Personas

### 3.1 Cluster Administrator (Primary)

- **Who**: The person maintaining the Kubernetes cluster and GitOps repository
- **Needs**: Easy deployment, configuration via YAML/environment variables, low maintenance
- **Pain Points**: Managing multiple auth systems, heavy resource usage, complex upgrades

### 3.2 Household Members (End Users)

- **Who**: Family members or trusted users accessing self-hosted applications
- **Needs**: Simple login experience, passwordless options, don't want to remember yet another password
- **Pain Points**: Too many passwords, friction accessing apps on local network

### 3.3 External Guests (Secondary)

- **Who**: Occasional visitors granted temporary access to specific applications (e.g., Plex shares)
- **Needs**: Easy onboarding, limited access scope
- **Pain Points**: Complex registration processes

---

## 4. Functional Requirements

### 4.1 Authentication Methods

| Method               | Priority | Description                                                |
| -------------------- | -------- | ---------------------------------------------------------- |
| **Passkeys**         | P0       | WebAuthn/FIDO2 resident credentials for passwordless login |
| **Email + Password** | P0       | Traditional authentication as fallback                     |
| **SIWE (Ethereum)**  | P1       | Sign-In With Ethereum for Web3 wallet authentication       |
| **Magic Links**      | P2       | Email-based passwordless login                             |
| **Social OAuth**     | P3       | GitHub, Google login (future consideration)                |

### 4.2 Core Features

#### 4.2.1 Forward Authentication Endpoint

- **Purpose**: Integration with Kubernetes ingress controllers (nginx, Traefik)
- **Behavior**: Validates session cookies and returns appropriate response headers
- **Response**:
  - `200 OK` + user headers for authenticated requests
  - `401 Unauthorized` for unauthenticated requests

#### 4.2.2 Login Interface

- **Purpose**: User-facing authentication UI
- **Features**:
  - Passkey prompt (when available)
  - Email/password form
  - Ethereum wallet connect button
  - Redirect handling back to original application
  - Error messaging

#### 4.2.3 User Management

- **Self-Registration**: Configurable (enabled/disabled via environment)
- **Admin Panel**: Basic user list, disable/enable accounts, revoke sessions
- **Profile Management**: Users can manage their own passkeys and linked wallets

#### 4.2.4 Session Management

- **Cookie-Based Sessions**: HTTP-only, secure cookies scoped to parent domain
- **Session Listing**: Users can view and revoke active sessions
- **Configurable Expiry**: Session lifetime configurable via environment

#### 4.2.5 OIDC Provider (Optional)

- **Purpose**: Provide OIDC identity for applications that require it (Grafana, ArgoCD)
- **Features**:
  - Authorization code flow
  - Client registration (static configuration)
  - Standard OIDC endpoints (`.well-known`, token, userinfo)
  - Consent screen (bypassable for trusted clients)

### 4.3 Routes Overview

| Route Pattern                       | Type | Purpose                                   |
| ----------------------------------- | ---- | ----------------------------------------- |
| `/api/verify`                       | API  | Forward-auth check for ingress            |
| `/api/auth/*`                       | API  | BetterAuth API (login, register, session) |
| `/login`                            | Page | Login page                                |
| `/register`                         | Page | Registration page (if enabled)            |
| `/settings`                         | Page | User settings (passkeys, sessions)        |
| `/admin/*`                          | Page | Admin panel (if user has admin role)      |
| `/.well-known/openid-configuration` | API  | OIDC discovery                            |
| `/oauth2/*`                         | API  | OIDC authorization and token endpoints    |
| `/api/health`                       | API  | Kubernetes health/readiness probe         |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric                     | Target       |
| -------------------------- | ------------ |
| Cold start time            | < 3 seconds  |
| Forward-auth response time | < 50ms (p95) |
| Memory usage (idle)        | < 200MB      |
| Memory usage (peak)        | < 400MB      |
| CPU usage (idle)           | < 20m cores  |

### 5.2 Security

- All cookies marked `HttpOnly`, `Secure`, `SameSite=Lax`
- CSRF protection on all state-changing operations
- Rate limiting on authentication endpoints
- Password hashing with Argon2
- No sensitive data in logs

### 5.3 Reliability

- Graceful shutdown handling for Kubernetes
- Health endpoint for liveness/readiness probes
- Stateless application (all state in database)
- Automatic session cleanup

### 5.4 Observability

- Structured JSON logging
- Request ID propagation
- Prometheus metrics endpoint (optional, P2)

---

## 6. Technical Architecture

### 6.1 Technology Stack

| Layer             | Technology     | Rationale                                                                 |
| ----------------- | -------------- | ------------------------------------------------------------------------- |
| **Runtime**       | Bun            | Fast JavaScript runtime, excellent cold start, native TypeScript          |
| **Framework**     | TanStack Start | Full-stack React framework with SSR, file-based routing, server functions |
| **Auth Library**  | BetterAuth     | Modern TypeScript auth library with plugin architecture                   |
| **UI Components** | shadcn/ui      | Accessible, customizable component library                                |
| **Styling**       | Tailwind CSS   | Utility-first CSS, optimized builds                                       |
| **Database**      | PostgreSQL     | Via external CloudNative-PG in Kubernetes                                 |

### 6.2 Why TanStack Start (Unified Stack)

TanStack Start provides native BetterAuth integration, eliminating the need for a separate API server:

1. **Server Routes**: Handle `/api/auth/*` and `/api/verify` via file-based API routes
2. **SSR**: Server-side rendering for login pages with proper session handling
3. **Middleware**: Built-in middleware system for route protection
4. **Cookie Handling**: Native plugin (`tanstackStartCookies`) for proper cookie management
5. **Type Safety**: End-to-end TypeScript with shared types between client and server

This approach reduces complexity compared to running separate Hono + React servers.

### 6.3 Project Structure

```
auth-server/
├── src/
│   ├── routes/                    # TanStack Start file-based routing
│   │   ├── __root.tsx             # Root layout
│   │   ├── index.tsx              # Home/redirect
│   │   ├── login.tsx              # Login page
│   │   ├── register.tsx           # Registration page
│   │   ├── settings.tsx           # User settings page
│   │   ├── consent.tsx            # OAuth consent page
│   │   ├── admin/                 # Admin pages
│   │   │   └── index.tsx
│   │   └── api/                   # API routes
│   │       ├── auth/
│   │       │   └── $.ts           # BetterAuth catch-all handler
│   │       ├── verify.ts          # Forward-auth endpoint
│   │       └── health.ts          # Health check endpoint
│   ├── lib/
│   │   ├── auth.ts                # BetterAuth instance configuration
│   │   ├── auth-client.ts         # BetterAuth client
│   │   ├── middleware.ts          # Auth middleware for protected routes
│   │   └── config.ts              # Environment/config loading
│   ├── components/                # React components
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── login-form.tsx
│   │   ├── passkey-button.tsx
│   │   ├── wallet-connect.tsx
│   │   └── ...
│   └── styles/
│       └── globals.css            # Tailwind imports
├── public/                        # Static assets
├── app.config.ts                  # TanStack Start configuration
├── Dockerfile                     # Container build
├── tailwind.config.ts             # Tailwind configuration
├── tsconfig.json                  # TypeScript configuration
├── components.json                # shadcn/ui configuration
└── package.json                   # Dependencies
```

### 6.4 Key Integration Points

#### BetterAuth Server Configuration

The BetterAuth instance is configured in `src/lib/auth.ts` with:

- Database adapter (PostgreSQL)
- Session configuration (cookie domain, expiry)
- Enabled plugins (passkey, SIWE, OIDC provider)
- `tanstackStartCookies` plugin for proper cookie handling

#### BetterAuth API Handler

Mounted at `/api/auth/$` using TanStack Start's server route handlers:

```
src/routes/api/auth/$.ts
```

This catch-all route delegates all `/api/auth/*` requests to BetterAuth.

#### Forward-Auth Endpoint

A dedicated API route at `/api/verify` that:

- Reads session from request cookies
- Validates session via BetterAuth
- Returns `200` with user headers or `401`

#### Protected Routes

TanStack Start middleware protects routes requiring authentication:

- Settings page
- Admin pages
- Any future protected routes

### 6.5 Configuration Model

The application reads configuration from environment variables, with optional YAML file for complex settings.

**Environment Variables (Core):**

| Variable             | Required | Description                                     |
| -------------------- | -------- | ----------------------------------------------- |
| `DATABASE_URL`       | Yes      | PostgreSQL connection string                    |
| `BETTER_AUTH_SECRET` | Yes      | Secret key for signing sessions/tokens          |
| `BETTER_AUTH_URL`    | Yes      | Public URL (e.g., `https://auth.domain.com`)    |
| `COOKIE_DOMAIN`      | Yes      | Parent domain for cookies (e.g., `.domain.com`) |
| `NODE_ENV`           | No       | `production` or `development`                   |

**Environment Variables (Features):**

| Variable               | Default | Description                                   |
| ---------------------- | ------- | --------------------------------------------- |
| `ENABLE_REGISTRATION`  | `false` | Allow public user registration                |
| `ENABLE_PASSKEYS`      | `true`  | Enable WebAuthn authentication                |
| `ENABLE_SIWE`          | `true`  | Enable Ethereum wallet login                  |
| `ENABLE_OIDC_PROVIDER` | `true`  | Enable OIDC provider functionality            |
| `ADMIN_EMAILS`         | -       | Comma-separated list of admin email addresses |

**YAML Configuration (Optional):**

For complex settings like OIDC clients, a mounted YAML file can be used:

```yaml
# /config/auth.yaml
oidcClients:
  - clientId: grafana
    name: Grafana
    redirectUris:
      - https://grafana.domain.com/login/generic_oauth
    skipConsent: true
```

### 6.6 Database Schema

The application uses BetterAuth's schema with extensions:

- `user` — Core user identity
- `session` — Active sessions
- `account` — Linked OAuth/social accounts
- `passkey` — WebAuthn credentials (BetterAuth passkey plugin)
- `oauth_application` — OIDC clients (BetterAuth OIDC plugin)
- `oauth_access_token` — Issued tokens
- `oauth_consent` — User consent records

Database migrations are managed by BetterAuth CLI or applied at startup.

---

## 7. User Interface Design

### 7.1 Pages

| Page         | Route       | Description                                |
| ------------ | ----------- | ------------------------------------------ |
| **Login**    | `/login`    | Primary authentication page                |
| **Register** | `/register` | New user registration (if enabled)         |
| **Settings** | `/settings` | User profile, passkey management, sessions |
| **Admin**    | `/admin`    | User management for administrators         |
| **Consent**  | `/consent`  | OAuth consent screen for OIDC flows        |
| **Error**    | `/error`    | Error display page                         |

### 7.2 Login Page Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Login Page                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              🔐 Sign in to Home Cluster             │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  [👆 Sign in with Passkey]                          │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ─────────────────── or ────────────────────               │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  [🦊 Connect Wallet]                                │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ─────────────────── or ────────────────────               │
│                                                             │
│   Email:    [________________________]                      │
│   Password: [________________________]                      │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  [Sign In]                                          │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   Don't have an account? Register (if enabled)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Design System

- **Theme**: Dark mode primary, light mode support
- **Colors**: Customizable via CSS variables, default to a modern dark palette
- **Typography**: System font stack or configurable custom font
- **Components**: shadcn/ui defaults with minimal customization
- **Branding**: Configurable app name and optional logo URL via environment

---

## 8. Container Image

### 8.1 Image Specifications

| Attribute        | Value                |
| ---------------- | -------------------- |
| **Base Image**   | `oven/bun:alpine`    |
| **Final Size**   | < 150MB              |
| **User**         | Non-root (`bun:bun`) |
| **Port**         | 3000                 |
| **Health Check** | `GET /api/health`    |

### 8.2 Build Process

1. Install dependencies with `bun install --frozen-lockfile`
2. Build application with TanStack Start's build command
3. Copy built assets to slim runtime image
4. Set non-root user and expose port

### 8.3 Multi-Architecture

Images will be built for:

- `linux/amd64`
- `linux/arm64`

---

## 9. CI/CD Pipeline

### 9.1 GitHub Actions Workflows

#### 9.1.1 Pull Request Workflow

**File**: `.github/workflows/ci.yaml`

**Trigger**: On PR to `main`

**Jobs**:

1. **Lint & Type Check**
   - Run ESLint
   - Run TypeScript compiler (`tsc --noEmit`)
   - Check formatting with Prettier

2. **Build Validation**
   - Build container image (don't push)
   - Verify image builds successfully

#### 9.1.2 Release Workflow

**File**: `.github/workflows/release.yaml`

**Trigger**: On push to `main` or tag push (`v*`)

**Jobs**:

1. **Build & Push Image**
   - Set up QEMU for multi-arch
   - Set up Docker Buildx
   - Login to GitHub Container Registry
   - Build multi-arch image (`linux/amd64`, `linux/arm64`)
   - Push to `ghcr.io/<org>/auth-server`
   - Tag with:
     - `latest` (for main branch)
     - `sha-<commit>` (always)
     - `v1.2.3` (for version tags)

2. **Security Scan**
   - Run Trivy vulnerability scan on built image
   - Upload results to GitHub Security tab
   - Fail on critical vulnerabilities (optional)

### 9.2 Versioning Strategy

- **Semantic Versioning**: `MAJOR.MINOR.PATCH`
- **Main Branch**: Tagged as `latest` and `sha-<short-sha>`
- **Release Tags**: `v1.0.0` creates `1.0.0`, `1.0`, `1` tags

### 9.3 Registry

| Registry                  | Path                        | Visibility                      |
| ------------------------- | --------------------------- | ------------------------------- |
| GitHub Container Registry | `ghcr.io/<org>/auth-server` | Private (recommended) or Public |

### 9.4 Renovate Integration

The GitOps repository should have Renovate configured to:

- Watch for new image tags at `ghcr.io/<org>/auth-server`
- Auto-create PRs for image updates
- Optionally auto-merge patch versions

---

## 10. Deployment Model

### 10.1 GitOps Integration

The auth server is designed for deployment via the consuming GitOps repository using the `bjw-s/app-template` Helm chart.

**Expected GitOps Repository Structure:**

```
manifests/apps/auth/
├── namespace.yaml
├── kustomization.yaml
└── auth-server/
    ├── kustomization.yaml
    ├── helmrelease.yaml      # References ghcr.io/<org>/auth-server
    ├── configmap.yaml        # Runtime configuration (optional YAML config)
    └── secret.sops.yaml      # Encrypted secrets
```

### 10.2 Required Kubernetes Resources

The auth server expects these resources to be provided by the GitOps repository:

| Resource                | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| **PostgreSQL Database** | User and session storage (via CloudNative-PG) |
| **Ingress**             | External access to auth endpoints             |
| **Secrets**             | Database credentials, BetterAuth secret       |
| **ConfigMap**           | Optional YAML configuration for OIDC clients  |

### 10.3 Helm Values Interface

The container exposes configuration via environment variables, which map to Helm values:

```yaml
# Example helm values structure
controllers:
  auth-server:
    containers:
      app:
        image:
          repository: ghcr.io/<org>/auth-server
          tag: latest
        env:
          DATABASE_URL:
            valueFrom:
              secretKeyRef:
                name: auth-server-secret
                key: database-url
          BETTER_AUTH_SECRET:
            valueFrom:
              secretKeyRef:
                name: auth-server-secret
                key: auth-secret
          BETTER_AUTH_URL: "https://auth.example.com"
          COOKIE_DOMAIN: ".example.com"
          ENABLE_REGISTRATION: "false"
          ENABLE_PASSKEYS: "true"
          ENABLE_SIWE: "true"
```

### 10.4 Ingress Annotations for Protected Apps

Applications in the cluster use these annotations to enable forward-auth:

```yaml
annotations:
  nginx.ingress.kubernetes.io/auth-url: "http://auth-server.auth.svc.cluster.local:3000/api/verify"
  nginx.ingress.kubernetes.io/auth-signin: "https://auth.example.com/login?rd=$escaped_request_uri"
  nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-User,X-Auth-Id,X-Auth-Email"
```

---

## 11. Testing Strategy

### 11.1 Unit Tests

- Auth logic (session validation, token generation)
- Configuration loading
- Utility functions

### 11.2 Integration Tests

- Database operations (using test database)
- Full authentication flows
- API endpoint responses

### 11.3 E2E Tests (Future - P2)

- Playwright tests for login UI
- Full passkey flow with WebAuthn emulation
- OIDC flow testing

---

## 12. Milestones & Phases

### Phase 1: Foundation (MVP)

**Goal**: Minimal working auth server with password authentication

- [ ] Project scaffolding (TanStack Start + Bun)
- [ ] BetterAuth integration with PostgreSQL
- [ ] Login/Register pages with email + password
- [ ] Forward-auth `/api/verify` endpoint
- [ ] Basic UI with shadcn/ui and Tailwind
- [ ] Dockerfile and GitHub Actions CI/CD
- [ ] Health endpoint

**Deliverable**: Working container that can authenticate users and integrate with nginx ingress

### Phase 2: Passwordless

**Goal**: Add passkey support for modern passwordless auth

- [ ] BetterAuth passkey plugin integration
- [ ] Passkey registration flow in settings
- [ ] Passkey login button on login page
- [ ] Passkey management UI (view/delete registered keys)

**Deliverable**: Users can register and login with passkeys

### Phase 3: Web3

**Goal**: Add Ethereum wallet authentication

- [ ] BetterAuth SIWE plugin integration
- [ ] Wallet connect component (RainbowKit or similar)
- [ ] Wallet address display in user profile
- [ ] Wallet-only registration option

**Deliverable**: Users can login with MetaMask or other Ethereum wallets

### Phase 4: OIDC Provider

**Goal**: Enable OIDC for applications that require it

- [ ] BetterAuth OIDC provider plugin
- [ ] OIDC client configuration via environment/YAML
- [ ] Consent screen implementation
- [ ] Discovery and token endpoints

**Deliverable**: Can act as OIDC provider for Grafana, ArgoCD, etc.

### Phase 5: Polish

**Goal**: Production hardening and admin features

- [ ] Admin panel for user management
- [ ] Session management UI (view/revoke)
- [ ] Rate limiting on auth endpoints
- [ ] Improved error handling and logging
- [ ] Prometheus metrics endpoint (optional)

**Deliverable**: Production-ready auth server

---

## 13. Success Metrics

| Metric                 | Target  | Measurement           |
| ---------------------- | ------- | --------------------- |
| Memory usage           | < 250MB | Container metrics     |
| Auth latency (p95)     | < 100ms | Application logs      |
| Container image size   | < 150MB | Docker inspect        |
| Successful deployments | 100%    | GitOps reconciliation |
| Login success rate     | > 99%   | Application metrics   |

---

## 14. Risks & Mitigations

| Risk                                 | Impact | Likelihood | Mitigation                                 |
| ------------------------------------ | ------ | ---------- | ------------------------------------------ |
| BetterAuth breaking changes          | High   | Medium     | Pin versions, test before upgrade          |
| TanStack Start stability             | Medium | Medium     | Pin versions, monitor releases             |
| Session cookie issues across domains | High   | Medium     | Thorough testing of cookie configuration   |
| Database connection issues           | Medium | Low        | Connection pooling, retry logic            |
| Passkey browser support              | Low    | Low        | Fallback to password auth always available |
| SIWE wallet adoption                 | Low    | Medium     | Optional feature, fallback auth methods    |

---

## 15. Open Questions

1. **Social OAuth**: Should Phase 1 include GitHub/Google OAuth, or defer to later phases?
2. **Email delivery**: How to handle password reset emails? External SMTP service or defer feature?
3. **Rate limiting**: Implement in-app or rely on ingress-level rate limiting?
4. **Database migrations**: Run at startup or require manual migration step?
5. **Branding**: How much customization to expose (logo, colors, app name)?

---

## 16. Appendix

### A. Reference Links

- [BetterAuth Documentation](https://www.better-auth.com/docs)
- [BetterAuth TanStack Start Integration](https://www.better-auth.com/docs/integrations/tanstack)
- [TanStack Start](https://tanstack.com/start)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)
- [bjw-s app-template](https://github.com/bjw-s/helm-charts)

### B. Glossary

| Term               | Definition                                                                          |
| ------------------ | ----------------------------------------------------------------------------------- |
| **Forward Auth**   | Authentication pattern where ingress calls an external service to validate requests |
| **SIWE**           | Sign-In With Ethereum — authentication using Ethereum wallet signatures             |
| **Passkey**        | WebAuthn/FIDO2 credentials stored on user's device or security key                  |
| **OIDC**           | OpenID Connect — identity layer on top of OAuth 2.0                                 |
| **GitOps**         | Infrastructure management using Git as source of truth                              |
| **TanStack Start** | Full-stack React framework with server-side rendering and file-based routing        |

### C. Example GitHub Actions Workflow

```yaml
# .github/workflows/release.yaml
name: Release

on:
  push:
    branches: [main]
    tags: ["v*"]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix=sha-
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### D. Example Dockerfile

```dockerfile
# Build stage
FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Production stage
FROM oven/bun:1-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 app

COPY --from=builder --chown=app:app /app/.output ./.output
COPY --from=builder --chown=app:app /app/package.json ./

USER app

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["bun", "run", ".output/server/index.mjs"]
```

---

_Document Version: 1.0.0_  
_Last Updated: December 2024_
