# Coding Conventions

## Database Schema

BetterAuth uses **camelCase** column names via Kysely adapter (not snake_case):

- Table: `"oauthApplication"`
- Columns: `"clientId"`, `"clientSecret"`, `"redirectUrls"`, `"createdAt"`

When writing raw SQL queries, always quote identifiers and use camelCase.

## Database Access

**Prefer Better Auth API methods over direct database queries.** Use `auth.api.*` endpoints for type-safe data access when available. Direct `pool.query()` should only be used when:

1. Better Auth doesn't expose the needed endpoint
2. The endpoint requires authentication but you need unauthenticated access (e.g., pre-auth invitation preview)
3. You need a custom query not supported by Better Auth

See [Better Auth Organization Plugin Docs](https://www.better-auth.com/docs/plugins/organization) for available API methods. Other plugin docs also available - use context7 MCP to find. Type signature of `auth.api` shows available methods.

## Environment Variables (T3Env)

Split configuration for security:

### Server-only (`src/env.ts`)

- Uses `process.env` (Node.js)
- Database credentials, secrets, OIDC clients
- Export `serverEnv` for basic vars, `serverEnvWithOidc` for OIDC-aware code

### Client-safe (`src/env.client.ts`)

- Uses `import.meta.env` (Vite)
- Only `VITE_*` prefixed variables
- Can be imported in browser code

**Never import `src/env.ts` in client code - it will bundle secrets into the browser bundle!**

## Styling

- Tailwind CSS v4 with Vite plugin (not PostCSS)
- shadcn/ui components in `src/components/ui/`
- Biome formatting: tabs, double quotes

## Error Handling

- **Console logging:** Use structured logs with `[Context]` prefix (e.g., `[OIDC]`, `[BetterAuth]`)
- **Never log secrets:** Only log client IDs, not secrets/tokens
