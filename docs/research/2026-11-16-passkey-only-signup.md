# Passkey-only sign-up for invitees (research, 2026-11-16)

## Versions
- dream-auth pins better-auth, @better-auth/passkey, @better-auth/oauth-provider at 1.7.5 (package.json; patch patches/better-auth@1.7.5.patch).
- npm `latest` for both better-auth and @better-auth/passkey: 1.7.25 (2026-11-14). Beta: 1.8.0-beta.10 (2026-11-15). No stable 1.8 yet.
- Passkey plugin diff 1.7.5 -> 1.7.25 (read from tarballs, /tmp/ba1 vs /tmp/ba2): hardening only. Registration endpoints now use sensitiveSessionMiddleware + freshSessionMiddleware, expected origins are derived from server config instead of the request Origin header, registration challenge binds to a session-token digest (`registrationSource`), new `authenticatorSelection.userVerification` option. `registration.requireSession`, `resolveUser`, `afterVerification` and `createSession` already exist in 1.7.5, so nothing needed for this feature requires an upgrade.

## Does better-auth support passkey-first sign-up natively?
Partly. There is no "sign up with passkey" endpoint that creates a user.
- `passkey({ registration: { requireSession: false, resolveUser, afterVerification } })` lets /passkey/generate-register-options and /passkey/verify-registration run without a session. `resolveUser({ctx, context})` must return an EXISTING `{id, name}`; verify-registration only inserts a `passkey` row for `targetUserId` and, with body `createSession: true`, mints a session (@better-auth/passkey dist/index.mjs ~L106-133, L450-515). It never calls createUser. So the user row must be created by you (resolveUser/afterVerification calling internalAdapter.createUser), which is custom code.
- Documented/idiomatic pattern is the other one: create the user through a verified-email flow (emailOTP `/sign-in/email-otp`, or magic link), which issues a session, then register the passkey with that session.

## Invite gate and email verification
- emailOTP sign-in for an unknown email calls `internalAdapter.createUser({email, emailVerified: true,...}, {method: "email-otp"})` (better-auth 1.7.25 dist/plugins/email-otp/routes.mjs L395-410). Because internal-adapter.createUser runs `user.validateUserInfo` with `action: "create-user"` (dist/db/internal-adapter.mjs L166-182, fails closed), dream-auth's existing gate in src/lib/auth.ts L193 applies unchanged and checks the email against a pending, non-expired invitation. The OTP proves mailbox control, so the invitee's email ends up verified for free.
- Caveat: the OTP plugin also sends the sign-in OTP only when signup is not disabled; with the gate, a non-invited email still gets an OTP mail but the verify step 403s. Consider pre-checking the invitation before sending (see below).
- A custom resolveUser/createUser path would also hit the gate (same createUser), but you would need to verify the email yourself.
- Existing password users: unaffected. A passwordless user simply has no credential `account` row. A password user can add a passkey as today. Account linking already trusts email-otp. Passkey sign-in works for both.

## Options
A (recommended, plain): invitee lands on /register?invitationId=..., enters email, receives OTP (emailOTP type sign-in), verifies -> user created (gated, verified) + session -> immediately prompted to add a passkey with the existing `passkey.addPasskey()` (requireSession stays true; session is fresh so freshSessionMiddleware passes) -> then accept the invitation. No password anywhere. Fallback for a user who skips the passkey step: email OTP sign-in again.
B (careful): `requireSession:false` + `resolveUser` + `afterVerification` + `createSession:true` so passkey creation and account creation are atomic (no passwordless-but-passkeyless account if the user bails). Buys: no half-finished accounts, one ceremony. Costs: you create an unverified user yourself, must verify email separately (OTP first anyway), loosen the passkey endpoints for everyone (security surface; the 1.7.x hardening exists because of this), custom state to tie the challenge to the pending user.

## Code that would change (option A)
- src/routes/register.tsx: replace password/confirm fields with email + OTP code step (authClient.emailOtp.sendVerificationOtp / signIn.emailOtp) then a "Create passkey" step (authClient passkey.addPasskey); keep password form behind a "use a password instead" link or remove.
- src/lib/auth.ts: likely none for the gate. Optional: pre-check invitation inside emailOTP sendVerificationOTP for type sign-in to avoid mailing non-invitees; keep `emailAndPassword.disableSignUp` as is.
- src/lib/auth-client.ts: ensure emailOTPClient and passkeyClient plugins present.
- tests/e2e: new flow (WebAuthn virtual authenticator).
- docs/ORGANIZATION.md L160 is stale: it still says `databaseHooks.user.create.before`; the code uses `user.validateUserInfo`. Fix with the change.

## Risks / unknowns
- I did not run anything; findings come from reading 1.7.25 tarball source. Context7 / docs-site was not cross-checked, so confirm the docs wording before relying on it for docs.
- The gate currently matches by email only; the `invitationId` in the link is not checked there (confirm in src/lib/registration-gate.ts if you want the link bound to the invite).
- Lost-device recovery: passkey-only users recover via email OTP; that makes mailbox the root of trust, same as today's password reset.
- Where ENABLE_PASSKEYS=false, the flow must fall back to OTP-only or password.
