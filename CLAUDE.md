# CLAUDE.md

Self-hosted identity provider (TanStack Start + BetterAuth) with passkeys, SIWE, and OIDC provider for Kubernetes SSO.

## Commands

```bash
pnpm dev                              # Dev server (port 3000)
pnpm typecheck                        # TypeScript checking
pnpm check                            # Biome lint + format

# Database
pnpm dlx @better-auth/cli generate    # Generate migration SQL (review first!)
pnpm dlx @better-auth/cli migrate     # Apply migrations

# Testing
pnpm test                             # Unit tests (Vitest)
pnpm test:integration                 # Integration tests (Testcontainers)
pnpm test:e2e                         # E2E tests (Playwright)

# UI
pnpm dlx shadcn@latest add <component>
```

## Architecture Docs

- [Auth System (BetterAuth)](./docs/AUTH.md) - Plugin ordering, account linking, session loading
- [OIDC Provider](./docs/OIDC.md) - Client seeding, FK constraint workaround, testing
- [Kubernetes Integration](./docs/KUBERNETES.md) - Forward auth, auto-migrations, nginx config
- [Coding Conventions](./docs/CONVENTIONS.md) - Database schema, env vars, styling
- [Testing Guide](./docs/TESTING.md) - Mock factories, type-safe mocking patterns
- [E2E Testing](./docs/E2E-TESTING.md) - Playwright, Testcontainers setup

## Quick Reference

**Environment variables:** Server-only in `src/env.ts`, client-safe in `src/env.client.ts`. Never import server env in client code.

**Database access:** Prefer `auth.api.*` methods over direct `pool.query()`. BetterAuth uses camelCase columns.

**BetterAuth plugins:** Order matters - `jwt()` must come before `oidcProvider()`.

## Common Pitfalls

| Issue | Solution |
|-------|----------|
| OIDC token exchange FK error | Ensure `ENABLE_OIDC_PROVIDER=true`, check "Seeding N client(s)" in logs |
| Session not loading in SSR | Use `createServerFn()` from `src/lib/session.server.ts` |
| Env vars not working | Server: `serverEnv`/`serverEnvWithOidc`, Client: `clientEnv` (needs `VITE_` prefix) |
| Docker build fails | `SKIP_ENV_VALIDATION=true` only in Dockerfile builder stage (already set) |
