# Kubernetes Integration

## Forward Auth

**Endpoint:** `/api/verify` (`src/routes/api/verify.ts`)

Returns `200` with session headers or `401` redirect. Configure with nginx ingress:

```yaml
annotations:
  nginx.ingress.kubernetes.io/auth-url: "http://dream-auth.auth.svc:3000/api/verify"
  nginx.ingress.kubernetes.io/auth-signin: "https://auth.example.com/login?rd=$escaped_request_uri"
  nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-User,X-Auth-Id,X-Auth-Email"
```

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
