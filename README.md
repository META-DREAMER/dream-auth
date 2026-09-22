# Dream Auth

A lightweight, self-hosted identity provider for home Kubernetes clusters. Supports modern authentication methods including passkeys (WebAuthn), Sign-In With Ethereum (SIWE), and traditional email/password — all while acting as an OIDC provider for your applications.

## Features

- **Passkeys** — Passwordless authentication via WebAuthn/FIDO2
- **SIWE** — Sign-In With Ethereum wallet authentication
- **OIDC Provider** — SSO for apps like Grafana, Immich, Weave GitOps
- **Forward Auth** — Kubernetes ingress integration for nginx/Traefik
- **Lightweight** — ~200MB RAM, fast cold starts

## Tech Stack

- [TanStack Start](https://tanstack.com/start) — Full-stack React framework
- [BetterAuth](https://better-auth.com) — Authentication library
- [PostgreSQL](https://www.postgresql.org) — Database
- [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS](https://tailwindcss.com) — UI

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, BETTER_AUTH_SECRET, etc.

# Run database migrations
pnpm dlx auth migrate

# Start development server
pnpm dev
```

## Development Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run linter
pnpm format       # Format code
pnpm check        # Run all checks
pnpm typecheck    # TypeScript type checking
```

## Testing

```bash
# Unit tests (Vitest)
pnpm test                    # Run all unit tests
pnpm test:coverage           # Run with coverage report

# Integration tests (Testcontainers)
pnpm test:integration        # Run integration tests with real PostgreSQL

# E2E tests (Playwright)
pnpm test:e2e                # Run all E2E tests
pnpm test:e2e:ui             # Interactive UI mode
pnpm test:e2e:report         # View HTML report

# Run all tests
pnpm test:all                # Unit + Integration + E2E
```

See [docs/E2E-TESTING.md](./docs/E2E-TESTING.md) for detailed E2E testing documentation.

## Database Migrations

BetterAuth manages the database schema. Run migrations after pulling changes or adding plugins:

```bash
# Generate migration SQL (optional, to review)
pnpm dlx auth generate

# Apply migrations
pnpm dlx auth migrate
```

### Automatic Migrations (Kubernetes/GitOps)

For Kubernetes deployments, enable automatic migrations on server startup:

```bash
BETTER_AUTH_AUTO_MIGRATE=true
```

This is safe for multi-replica deployments because:

- **PostgreSQL advisory locks** prevent concurrent migrations across pods
- **No lock contention** when database is already up-to-date (skips lock acquisition)
- **Additive-only** — Better Auth migrations never drop columns or tables
- **Double-checked locking** — Re-verifies migrations after acquiring lock
- **Audit logging** — Logs exactly what tables/columns will be created

Optional configuration:

| Variable                                | Default                             | Description                                         |
| --------------------------------------- | ----------------------------------- | --------------------------------------------------- |
| `BETTER_AUTH_AUTO_MIGRATE`              | `false`                             | Enable auto-migrations on startup                   |
| `BETTER_AUTH_MIGRATION_LOCK_KEY`        | `dream-auth:better-auth:migrations` | Advisory lock key (change for multiple deployments) |
| `BETTER_AUTH_MIGRATION_LOCK_TIMEOUT_MS` | `600000` (10 min)                   | Timeout waiting for migration lock                  |

## Docker

```bash
# Build image
docker build -t dream-auth .

# Run with docker-compose (includes PostgreSQL)
docker-compose up -d
```

## Environment Variables

| Variable               | Required | Description                                    |
| ---------------------- | -------- | ---------------------------------------------- |
| `DATABASE_URL`         | Yes      | PostgreSQL connection string                   |
| `BETTER_AUTH_SECRET`   | Yes      | Secret for signing sessions (min 32 chars)     |
| `BETTER_AUTH_URL`      | Yes      | Public URL (e.g., `https://auth.example.com`)  |
| `COOKIE_DOMAIN`        | No       | Share cookies across subdomains (`.example.com`) |
| `TRUSTED_CLIENT_IP_HEADERS` | No  | Headers the client IP is read from, in order (default: `x-forwarded-for`; behind Cloudflare: `cf-connecting-ip,x-forwarded-for`) |
| `ENABLE_REGISTRATION`  | No       | Allow public registration (default: `false`)   |
| `ENABLE_PASSKEYS`      | No       | Enable Passkey support (default: `true`)       |
| `ENABLE_SIWE`          | No       | Enable Ethereum wallet login (default: `true`) |
| `ENABLE_OIDC_PROVIDER` | No       | Enable OIDC provider (default: `false`)        |
| `OIDC_CLIENTS`         | No       | JSON array of OIDC client configs              |
| `OIDC_CLIENTS_FILE`    | No       | Path to OIDC clients JSON file (for GitOps)    |
| `OIDC_REQUIRE_PKCE`    | No       | Enforce PKCE for OIDC (default: `true`)        |
| `EMAIL_PROVIDER`       | No       | `log` or `cloudflare` (default: `log`)         |
| `EMAIL_FROM`           | No       | Sender address (default: a non-routable stub)  |
| `EMAIL_FROM_NAME`      | No       | Sender display name (default: `Dream Auth`)    |
| `CLOUDFLARE_ACCOUNT_ID`| Cond.    | Required when `EMAIL_PROVIDER=cloudflare`      |
| `CLOUDFLARE_API_TOKEN` | Cond.    | Required when `EMAIL_PROVIDER=cloudflare`      |

See `.env.example` for all options.

## Cross-subdomain sessions

Set `COOKIE_DOMAIN` to the parent domain (`.example.com`) and auth cookies are
issued with a matching `Domain` attribute, so a session minted on
`auth.example.com` is sent to every sibling host. This uses better-auth's
`advanced.crossSubDomainCookies`, which scopes all four auth cookies rather
than only the session token.

Leave `COOKIE_DOMAIN` unset for local development: cookies stay host-only,
which is the only thing that works on `localhost`.

## Client IP and rate limiting

better-auth rate-limits per client IP, and since 1.6.17 it refuses to guess the
IP from a forwarded chain, because the left-most `X-Forwarded-For` entry is
whatever the client sent. With no resolvable IP every request shares one
bucket per path, which is both a denial-of-service vector and no brute-force
protection at all.

`TRUSTED_CLIENT_IP_HEADERS` is the ordered list of headers the IP is read from;
the first one holding a single valid address wins. Only list a header the proxy
in front of this server **overwrites on every path a client can take**. Behind
a Cloudflare tunnel that is `cf-connecting-ip,x-forwarded-for`: Cloudflare's
edge sets the first on every request it proxies, and the ingress overwrites the
second with its peer address, which is what makes it safe as the fallback for
traffic that did not cross Cloudflare. The default trusts `x-forwarded-for`
alone, and production logs a warning when the variable is unset.

See [docs/KUBERNETES.md](docs/KUBERNETES.md) for the measured header table,
the residual risk on the LAN path, and what to re-check after an ingress
migration.

## Email

Verification links, one-time codes and organization invitations are sent through
`src/lib/email/`. One `sendEmail()` primitive sits behind a transport interface
with two implementations:

- **`log`** (the default) sends nothing. Outside production it prints the message
  to stdout, which is how local development sees an OTP. In production it prints
  only `{ to, subject }` — never the body, because the body is a credential.
- **`cloudflare`** posts to the Cloudflare Email Sending REST API
  (`POST /accounts/{account_id}/email/sending/send`). `EMAIL_FROM` must be on a
  domain onboarded to Cloudflare Email Sending, and both `CLOUDFLARE_ACCOUNT_ID`
  and `CLOUDFLARE_API_TOKEN` must be set — `src/env.ts` refuses to start
  otherwise. The API token needs only **Account → Email Sending → Edit**.

A send is retried once on a transient failure (HTTP 429/5xx, network error) and
never on a permanent one (bad address, suppressed recipient).

### Failed invitation emails

An `invitation` row is written before better-auth calls `sendInvitationEmail`,
and better-auth does not roll it back when the callback throws. A failed send
therefore leaves a `pending` invitation that nobody received. That row is
harmless — it expires after 7 days, and until then it only widens the signup
allowlist for the address an admin deliberately chose — but the admin is told
about it: the members page surfaces the error and offers **Resend**.

Resend re-sends against the existing row (better-auth's `resend` flag) rather
than cancelling and recreating, so a second failure cannot destroy a working
invitation.

## OIDC Configuration

Configure OIDC clients via the `OIDC_CLIENTS` environment variable or `OIDC_CLIENTS_FILE` (for loading from a file/ConfigMap):

```bash
OIDC_CLIENTS='[{
  "clientId": "grafana",
  "clientSecret": "your-secret",
  "name": "Grafana",
  "redirectURLs": ["https://grafana.example.com/login/generic_oauth"],
  "skipConsent": true
}]'
```

Applications connect using:

- **Issuer URL**: `https://auth.example.com`
- **Discovery**: `https://auth.example.com/.well-known/openid-configuration`

## Forward Auth (Kubernetes Ingress)

For nginx ingress:

```yaml
annotations:
  nginx.ingress.kubernetes.io/auth-url: "http://dream-auth.auth.svc.cluster.local:3000/api/verify"
  nginx.ingress.kubernetes.io/auth-signin: "https://auth.example.com/login"
  nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Id,X-Auth-User,X-Auth-Email"
```

`auth-signin` deliberately has no query string: ingress-nginx appends
`?rd=<absolute url back to the app>` itself, which is the only form that works
across subdomains. Requires `COOKIE_DOMAIN` to be set. Authorize on
`X-Auth-Id`, never `X-Auth-Email`.

See [docs/KUBERNETES.md](docs/KUBERNETES.md) for the header trust model and the
headers that are *not* protected.

## API Endpoints

| Endpoint                            | Purpose                  |
| ----------------------------------- | ------------------------ |
| `/api/auth/*`                       | BetterAuth API           |
| `/api/verify`                       | Forward-auth check       |
| `/api/health`                       | Health check             |
| `/.well-known/openid-configuration` | OIDC discovery           |
| `/oauth2/*`                         | OIDC authorization/token |

## Adding UI Components

```bash
pnpm dlx shadcn@latest add button
```

## Project Structure

```
src/
├── routes/           # Pages and API routes
├── components/       # React components
├── lib/              # Auth config, utilities
└── hooks/            # Custom React hooks
```

## License

MIT

---

# TanStack Start Documentation

This project is built on [TanStack Start](https://tanstack.com/start). Below is reference documentation for the framework.

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route, add a new file in the `./src/routes` directory. TanStack will automatically generate the route content.

### Adding Links

Use SPA navigation with the `Link` component:

```tsx
import { Link } from "@tanstack/react-router";

<Link to="/about">About</Link>;
```

More information: [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

The layout is located in `src/routes/__root.tsx`. Anything added to the root route appears in all routes. Route content appears where you use `<Outlet />`.

Example layout with header:

```tsx
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Link } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <>
      <header>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
});
```

More information: [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Data Fetching

You can use TanStack Query or the `loader` functionality built into TanStack Router.

### Route Loaders

```tsx
const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/people",
  loader: async () => {
    const response = await fetch("https://swapi.dev/api/people");
    return response.json() as Promise<{
      results: { name: string }[];
    }>;
  },
  component: () => {
    const data = peopleRoute.useLoaderData();
    return (
      <ul>
        {data.results.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    );
  },
});
```

More information: [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

### React Query

Add dependencies:

```bash
pnpm add @tanstack/react-query @tanstack/react-query-devtools
```

Create a query client and provider in `main.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

Use `useQuery` to fetch data:

```tsx
import { useQuery } from "@tanstack/react-query";

function App() {
  const { data } = useQuery({
    queryKey: ["people"],
    queryFn: () =>
      fetch("https://swapi.dev/api/people")
        .then((res) => res.json())
        .then((data) => data.results as { name: string }[]),
    initialData: [],
  });

  return (
    <ul>
      {data.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  );
}
```

More information: [React Query documentation](https://tanstack.com/query/latest/docs/framework/react/overview).

## State Management

TanStack Store provides state management:

```bash
pnpm add @tanstack/store
```

Simple counter example:

```tsx
import { useStore } from "@tanstack/react-store";
import { Store } from "@tanstack/store";

const countStore = new Store(0);

function App() {
  const count = useStore(countStore);
  return (
    <button onClick={() => countStore.setState((n) => n + 1)}>
      Increment - {count}
    </button>
  );
}
```

Derived state example:

```tsx
import { useStore } from "@tanstack/react-store";
import { Store, Derived } from "@tanstack/store";

const countStore = new Store(0);

const doubledStore = new Derived({
  fn: () => countStore.state * 2,
  deps: [countStore],
});
doubledStore.mount();

function App() {
  const count = useStore(countStore);
  const doubledCount = useStore(doubledStore);

  return (
    <div>
      <button onClick={() => countStore.setState((n) => n + 1)}>
        Increment - {count}
      </button>
      <div>Doubled - {doubledCount}</div>
    </div>
  );
}
```

More information: [TanStack Store documentation](https://tanstack.com/store/latest).

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting:

```bash
pnpm run lint
pnpm run format
pnpm run check
```

## T3Env

Environment variables have type safety via T3Env. Add variables to `src/env.ts`:

```ts
import { env } from "@/env";

console.log(env.VITE_APP_TITLE);
```

## Learn More

- [TanStack documentation](https://tanstack.com)
