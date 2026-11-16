# 2026-11-16 - Email invitees could not create an account

## Report

The owner invited someone to dream-auth; they said "it didn't work".

## Where it failed

- Live DB: invitation `Af5w...` (role member, org `home`) created 2026-11-12
  03:44 UTC, still `pending`, and no user exists for that email. The invite
  email's own log line is gone (pod restarted 2026-11-13 03:04).
- Live probe: `POST https://auth.md.wtf/api/auth/sign-up/email` (test email,
  creates nothing) returns `400 EMAIL_PASSWORD_SIGN_UP_DISABLED`.
- Cause: `emailAndPassword.disableSignUp: !ENABLE_REGISTRATION` in
  `src/lib/auth.ts`. better-auth checks it first in `/sign-up/email`, before
  the `validateUserInfo` invitation gate, so the invite page's "Create one"
  path always ended at "Email and password sign up is not enabled". It has
  been this way since invitations were added; only SIWE could sign up.

## Fix

- Drop `disableSignUp`; the `validateUserInfo` gate stays the only gate.
- For password sign-ups (`source.method === "email-password"`) the gate also
  requires `invitationId` naming a pending invitation for the same email,
  sent by `/register` from its `redirect=/invite/<id>`. Without it, anyone who
  knew an invited email could register it first and join the org. Wallet
  addresses are not read for password sign-ups.

## Verification (local, ENABLE_REGISTRATION=false, fix branch)

| Step | Result |
|---|---|
| Owner creates invite via API, link from log transport | PASS |
| Sign-up without id / with wrong id / id with other email | 403 registration_disabled (PASS) |
| Browser: invite link -> Create one -> register | PASS, lands back on invite |
| Accept invitation | PASS, member of org |
| Add passkey (CDP virtual authenticator) | PASS |
| Sign out, sign in with passkey | PASS, new session, counter advanced |

## Not verified

- Live run on auth.md.wtf: creating an invite needs an owner/admin session in
  org `home`, which an agent does not have. Live sign-up, passkey and the
  Immich OAuth sign-in for a new user remain to be run after the deploy.
- Whether the 2026-11-12 invitation email was delivered (log rotated out).
