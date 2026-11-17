# better-auth 1.7.5 -> 1.7.25 (2026-11-16)

Covers `better-auth`, `@better-auth/passkey` and `@better-auth/oauth-provider`,
plus the internal `@better-auth/core` and `@better-auth/kysely-adapter`, all
moved from 1.7.5 to 1.7.25, which is npm `latest`. The 1.8 beta is not
included. Sources: GitHub releases v1.7.6 to v1.7.25, the repo's security
advisories, a diff of the npm tarballs, and the Context7 passkey docs.

## What this PR changes

- Versions: `better-auth`, `@better-auth/passkey` and
  `@better-auth/oauth-provider` go to `1.7.25`. The
  `pnpm.overrides["@better-auth/utils"]` pin moves from `0.5.0` to `0.5.1`,
  which is what 1.7.25 depends on, so there is still a single copy. There is
  also one copy each of `better-call` 1.4.5, `@better-fetch/fetch` 1.3.3 and
  `zod` 4.6.5.
- Patch: `patches/better-auth@1.7.5.patch` becomes
  `patches/better-auth@1.7.25.patch` (see below).
- Config: one change. oauth-provider now rejects a `web` client's `http:`
  redirect URI even on loopback ("Redirect URI must use HTTPS (HTTP allowed
  only for loopback hosts)") unless `allowInsecureRedirectUri` accepts it
  (added in 1.7.20). E2E and local dev use `http://localhost`, so
  `src/lib/oidc/insecure-redirect.ts` enables that callback only when
  `BETTER_AUTH_URL` itself is plain-HTTP loopback, and then accepts only
  loopback redirects. Production (`https`) keeps the strict default. A
  production client registered with an `http:` redirect URI would now fail.
  The production client list is SOPS-encrypted and was not inspected.
- Passkeys need no config change (see "Passkey changes" below).
- DB migrations: none. A Postgres database migrated with the 1.7.5 schema
  (passkey, SIWE, organization, OIDC provider and JWT all enabled) shows zero
  tables to create and zero columns to add under 1.7.25's `getMigrations`. The
  startup auto-migrate plugin therefore does nothing on rollout.

## Patch outcomes

| Patch | Outcome | Why |
|---|---|---|
| `better-auth` SIWE wallet linking (`dist/plugins/siwe/index.mjs`, `index.d.mts`): link a wallet to the signed-in user, plus an `account.delete.after` hook that removes the `walletAddress` row | **Ported** | Upstream PR better-auth/better-auth#7564 is still open, and 1.7.25's SIWE plugin still cannot link a wallet to an existing account. The body hunks applied unchanged. Only the imports were redone for 1.7.25's reordered imports and `import("…")` type style. |

No other patches, vendored code or `better-auth` overrides exist. The
remaining `pnpm.overrides` (`@noble/hashes`, `kysely`, `@peculiar/asn1-schema`,
`zod@4`) are unrelated to this upgrade and stay as they are.

Checked against a real Postgres with `ENABLE_REGISTRATION=false`, on main
after #30 (passwordless email-code sign-in) was merged in:

- A password sign-up is rejected by `emailAndPassword.disableSignUp` ("Email
  and password sign up is not enabled"), and no user is created.
- An email-code sign-in for an uninvited address is rejected by the
  `validateUserInfo` gate (`registration_disabled`), and no user is created.
- A SIWE sign-in from an unknown wallet is rejected with a 403
  `registration_disabled`, and no user is created.
- A signed-in user's SIWE verify links the wallet to that user and creates the
  `walletAddress` row and the `siwe` account. The wallet then signs in as the
  same user.
- Deleting the `siwe` account removes its `walletAddress` row.

## Passkey changes and what dream-auth needs

- **Expected origin comes from server config** (1.7.16, GHSA-gv75-j3v8-3crm).
  Before, the plugin trusted the request's `Origin` header. Now it uses
  `origin`, or else the `baseURL` origin plus any origin listed exactly in
  `trustedOrigins`. dream-auth already sets `origin: BETTER_AUTH_URL` and
  `rpID: <BETTER_AUTH_URL host>` and has no `baseURL.allowedHosts` wildcard, so
  production (`https://auth.md.wtf`) behaves as before. A misconfiguration now
  fails with a 500 `ORIGIN_NOT_CONFIGURED` instead of trusting the header.
- **Registration needs a sensitive (authoritative) session as well as a fresh
  one.** `generate-register-options` and `verify-registration` now run
  `sensitiveSessionMiddleware` (a database lookup that skips the cookie cache)
  before `freshSessionMiddleware`. The fresh-session check already existed in
  1.7.5. dream-auth has the cookie cache off and keeps the default `freshAge`
  (1 day), so adding a passkey right after sign-in still works.
- **The challenge is bound to a digest of the session token** when
  `registration.requireSession: false`. Registration options and verification
  must then come from the same session, or both go through `resolveUser`.
  dream-auth uses the default `requireSession: true`, so this only matters to
  the passkey-first sign-up flow being built on another branch.
- **`authenticatorSelection.userVerification`** is now enforced when set to
  `"required"`, for authentication as well as registration. The default is
  still `"preferred"`, and dream-auth does not set it.

## Security fixes in range (advisories that touch features dream-auth uses)

- GHSA-gv75-j3v8-3crm (low, passkey, 1.7.16): origin and user verification
  were not enforced. Fixed as described above.
- GHSA-2f9c-7xj7-gh55 (medium, 1.7.16): the email OTP attempt limit could be
  beaten with concurrent requests, and codes were loosely bound to addresses.
  dream-auth uses `emailOTP`.
- GHSA-hwq2-v29r-p69r (medium, 1.7.16): email-change links stayed valid after
  the address changed hands. dream-auth enables `changeEmail`.
- GHSA-c85h-5mrr-mgx4 (medium, 1.7.16): an organization admin could invite an
  owner by padding the role name. dream-auth uses `organization`.
- GHSA-fvxx-76fc-893x (medium, 1.7.16): revoked sessions stayed valid with the
  cookie cache or secondary storage. dream-auth uses neither, but passkey
  registration now checks the session store.
- 1.7.16 also stopped wildcard `trustedOrigins` from matching outside their
  scheme, host or path. dream-auth's `https://*.<COOKIE_DOMAIN>` matches the
  same origins on 1.7.5 and 1.7.25 (checked against the matcher).
- Not used by dream-auth: Magic Link and OAuth Proxy (critical and high,
  1.7.7), phone number, admin, Stripe, Expo, Electron, SSO, and MySQL serial
  IDs.

## Other notable changes

- 1.7.19, SIWE: user creation is transactional, so a failed wallet or account
  insert no longer leaves an orphan user that blocks the wallet. 1.7.21, SIWE:
  internal error messages no longer leak in the 401 response; they are logged
  on the server instead.
- 1.7.8: cookie attributes follow RFC 6265bis. A failed password reset no
  longer consumes the link or OTP.
- oauth-provider: many spec-conformance fixes. These include `invalid_client`
  responses and `WWW-Authenticate` challenges (1.7.10, 1.7.19, 1.7.22, 1.7.25),
  failed token requests no longer consuming the auth code (1.7.23), and refresh
  token reuse revoking in-flight access tokens (1.7.21). From 1.7.19, client
  `metadata` is written as JSON, not as a JSON string; old rows still read.
- 1.7.12, JWT plugin: tokens are verified with the stored key's algorithm, not
  the one in the token header, and the plugin warns when signing without an
  issuer or audience.
- 1.7.24: plugins accept any `better-call` 1.4.x from 1.4.5 as a peer. This
  removes the "two copies of better-call turns plugin errors into 500s"
  failure mode, which was one reason for the overrides.
- 1.7.15: hook-set headers and cookies on non-returning `hooks.before` are no
  longer dropped.

## What #30 relies on, rechecked on 1.7.25

#30 (email-code sign-in with a passkey offer) was written against 1.7.5. In
1.7.25 the following are unchanged:

- The `advanced.backgroundTasks.handler` option.
- `runInBackgroundOrAwait`.
- The organization plugin sends the invitation email first and then awaits
  `afterCreateInvitation`.
- email-otp still creates new users through `internalAdapter.createUser`,
  which runs `validateUserInfo`.

On the passkey offer: registration now also requires an authoritative session
(see above). A session that was just created passes, and E2E covers the offer
after a code sign-in.

## Breaking or behaviour changes

- Passkey: `ORIGIN_NOT_CONFIGURED` at runtime when no origin can be resolved,
  and registration needs an authoritative session (see above).
- oauth-provider: `http:` redirect URIs for `web` clients, loopback included,
  are rejected unless `allowInsecureRedirectUri` accepts them (see above).
  Native clients still get loopback, with any port.
- oauth-provider: a rejected `post_logout_redirect_uris` entry returns
  `invalid_redirect_uri` instead of `invalid_client_metadata` (1.7.21). A
  client secret without the configured prefix gets a standard
  `invalid_client` (1.7.19).
- Type declarations now mark type-only exports as `type` (1.7.13). dream-auth
  typechecks cleanly.

## Worth adopting later (one line each)

- `oauthProvider` `adminUpdateOAuthClient` pause/resume (1.7.8): disable an app's SSO without deleting its seeded client.
- `oauthProvider` `verifyOAuthQueryParams` (1.7.7): verify the signed query before rendering a custom consent page.
- `passkey({ authenticatorSelection: { userVerification: "required" } })`: enforce biometrics or a PIN now that it is honoured.
- `bannedUserMessage` (1.7.6): show a ban reason, if the admin plugin is adopted.
- An explicit JWT `audience` on `jwt()` (the issuer is already pinned), to satisfy the 1.7.12 warning about a missing audience.
- Rebase the `META-DREAMER/better-auth` fork onto v1.7.25, and wrap the linking writes in `runWithTransaction` as upstream did for sign-up.
