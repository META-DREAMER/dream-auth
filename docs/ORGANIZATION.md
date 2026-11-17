# Organization & Teams

BetterAuth organization plugin with teams, role-based permissions, and email/wallet invitation system.

## Plugin Configuration

**Location:** `src/lib/auth.ts`

```ts
organization({
  teams: { enabled: true },
  invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days
  schema: {
    invitation: {
      additionalFields: {
        walletAddress: { type: "string", required: false, input: true },
      },
    },
  },
  // hooks and email sending configured below
})
```

Client-side: `organizationClient({ teams: { enabled: true } })` in `src/lib/auth-client.ts`.

## Role Model

| Role | Manage Members | Manage Teams | Edit Settings | Delete Org |
|------|:-:|:-:|:-:|:-:|
| Owner | Yes | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes | No |
| Member | No | No | No | No |

**Hook:** `src/hooks/use-org-permissions.ts`

```ts
const { isOwner, isAdmin, isOwnerOrAdmin, isMember, currentMember } = useOrgPermissions();
```

## Organization CRUD

### Create

**Component:** `src/components/org/create-org-dialog.tsx`

Form: name, slug (auto-generated), logo URL. API: `organization.create({ name, slug, logo })`.

**Who may create one:** users who are already owner or admin of some
organization - or anyone, while no organization exists yet (bootstrap). Once
the first org exists, a plain member or a user with no org gets `FORBIDDEN`
from `POST /organization/create`. The rule is `allowUserToCreateOrganization`
in `src/lib/auth.ts`, implemented in `src/lib/org-creation-policy.ts`; the
switcher hides the "Create Organization" entry via `canCreateOrganizationFn`
(`src/lib/org-creation.server.ts`), but the server is the gate.

Why: slugs are free-form, and both the OIDC `groups` claim and any
slug-keyed RBAC downstream would trust `home` from whoever created an org
called that. Forward auth itself pins the org by id, so it is not exposed,
but the claim is.

Slugs are limited to `[a-z0-9-]` on create and update
(`beforeCreateOrganization` / `beforeUpdateOrganization`, from
`src/lib/org-policy.ts`): a `:` in a slug could spell a `<slug>:role:<role>`
or `<slug>:team:<name>` entry of another org in the claim. The claim builder
also drops any org whose slug still contains `:`, as a backstop.

**Existing organizations are not retroactively restricted.** Whoever owned
an org before this rule keeps the ability to create more, and every org that
already exists still lands in the `groups` claim. After deploying, audit
with the query in [KUBERNETES.md](./KUBERNETES.md#rollout) and delete stray
orgs.

### Settings

**Route:** `src/routes/_authed/org/settings.tsx`

Owner/Admin can edit name, slug, and logo. Owner can delete (requires typing org name to confirm).

The page also shows the **Organization ID** (read-only, with a copy button).
That is the value for `FORWARD_AUTH_ORG_ID` - see
[Forward-auth access](#forward-auth-access).

### Switcher

**Component:** `src/components/org/org-switcher.tsx`

Sidebar dropdown listing all user orgs. Switch via `organization.setActive({ organizationId })`.

## Members

**Route:** `src/routes/_authed/org/members.tsx`

Table with name, role badge, join date, and actions (change role, remove). Owner/Admin only for management actions.

### Role Badge

**Component:** `src/components/org/role-badge.tsx`

- Owner: violet
- Admin: blue
- Member: gray (muted)

### Edit Role

**Component:** `src/components/org/edit-member-role-dialog.tsx`

Select between Admin and Member. Owner role cannot be reassigned via UI.

## Invitation System

Two invitation types: **email** and **wallet** (SIWE).

### Email Invitations

```ts
inviteByEmail(email, role, organizationId)
```

An invitee without an account signs up with an email code; no password is
involved. See [Invitation-Only Registration](#invitation-only-registration).

### Wallet Invitations

```ts
inviteByWallet(walletAddress, role, organizationId)
```

Generates deterministic email `{walletAddress}@{auth-domain}`. Stores `walletAddress` on invitation record. See [WEB3.md](./WEB3.md) for wallet verification details.

**Helpers:** `src/lib/invite-helpers.ts` — `getWalletEmail()`, `isWalletInvitation()`, `getInvitationWalletAddress()`

### Invitation Page

**Route:** `src/routes/invite.$id.tsx`. The invite link is the invitee's whole
journey; the page offers no generic sign-in options.

| Visitor | Page |
|---------|------|
| Signed out, email invitation | One card: Name, the invited email (read-only), "Continue" |
| Signed out, wallet invitation | "Connect Wallet" (SIWE), then joins automatically |
| Signed in as the invitee | One button: "Join <org>" |
| Signed in as someone else | "This invitation is for ..." and "Switch account" (signs out, same link) |
| Expired / accepted / rejected / canceled / unknown id | A message, nothing else |

"Continue" emails a sign-in code; the same card turns into the code input.
The code signs in (creating the account, named, email verified), the page
accepts the invitation itself, then offers a passkey, then shows a done screen,
or goes to `?redirect=` / `?rd=` (validated like `/login`) when present. If the
accept fails after sign-in, the card drops to the signed-in "Join" state with
the error. Opening the page has no side effects: link scanners open it too.

**Lookup before sign-in:** `getInvitationPreviewFn`
(`src/lib/invitation-preview.server.ts`, shape in `src/lib/invitation-preview.ts`).
A direct DB query, keyed by invitation id only, because better-auth's
`getInvitation` needs the invitee's session. A pending invitation yields the
email, organization name and inviter *name* (never the inviter's email; with
no name the page says "an admin of <org>"); a wallet invitation yields a masked
wallet instead of its derived email. Anything else yields only its state.

### Invitation Lifecycle

| Status | Description |
|--------|-------------|
| `pending` | Active, waiting for response |
| `accepted` | User joined the organization |
| `rejected` | User declined |
| `canceled` | Admin/owner canceled |

**Expiration:** 7 days. Resending cancels the old invitation and creates a new one.

### Accept Checks

**Location:** `src/lib/auth.ts` (`beforeAcceptInvitation`), logic in
`src/lib/invitation-accept-policy.ts`. On top of better-auth's own check that
the session email equals the invitation email:

- **Email invitation:** the user's email must be verified.
  `changeEmail.updateEmailWithoutVerification` lets an unverified account (a
  wallet user's placeholder) set its email to any address without proof, so
  the email match alone would let it accept a leaked link. That option stays
  on because "Link email" in settings (`useEmailVerification`) depends on it.
  better-auth's `requireEmailVerificationOnInvitation` is not used: it applies
  to wallet invitations too, whose users never have a verified email.
- **Wallet invitation:** the user must have a SIWE account for the invited
  wallet.

Either refusal is `APIError("FORBIDDEN")`.

### Invitation-Only Registration

When `ENABLE_REGISTRATION=false`, `user.validateUserInfo` in
`src/lib/auth.ts` (logic in `src/lib/registration-gate.ts`) runs on every path
that creates a user (email code, password, SIWE) and admits the new user only
when a pending, unexpired invitation matches the email, or the wallet for a
wallet invitation. Anything else fails with `registration_disabled`.

**Sign-up from an email invitation (passwordless):**

1. The invite link opens `/invite/<id>` with the invited email prefilled.
2. The invitee enters a name; "Continue" calls
   `/email-otp/send-verification-otp` with `type: "sign-in"`.
3. They enter the 6-digit code. `/sign-in/email-otp` finds no user and calls
   `internalAdapter.createUser` with `emailVerified: true` and the name, which
   runs the `validateUserInfo` gate above. The code proves the mailbox, so the
   gate matches on the email alone. The account and a session are created (an
   existing user is just signed in; their name is left alone).
4. The page accepts the invitation.
5. While the session is fresh, they are offered a passkey
   (`passkey.addPasskey()`, `requireSession` stays on). "Not now" is
   remembered in this browser for 30 days. Then the done screen.

**Who gets a code.** The send endpoint answers `{ success: true }` for every
address. The `sendVerificationOTP` callback mails a sign-in code only when
`shouldSendSignInCode` says the address belongs to an existing user or has a
pending email invitation (or public registration is on). Every email send
(codes of every type, password reset, verification, invitations) runs
detached from its request through `advanced.backgroundTasks` in
`src/lib/auth.ts`, so no endpoint's response or timing says which addresses
exist. A failed send is logged and never surfaces as an unhandled rejection;
invitation failures still reach the admin through `afterCreateInvitation`.

**Password sign-up is off** (`emailAndPassword.disableSignUp: true`).
Accounts are created by email code or SIWE; password sign-in stays for the
accounts that already have one.

**Sign-in.** `/login` defaults to the email code, with "Sign in with Passkey"
and SIWE above it and "Sign in with a password instead" for accounts that have
one. A code sign-in by a user with no passkey gets the same passkey offer.
When `/login` was reached from an app's OAuth redirect, both code requests
carry the signed query (`ba_param`, `sig`, ...) as `oauth_query`, and the URL
is never changed between the steps. The offer is awaited inside the sign-in's
`onSuccess`, which better-fetch runs before better-auth's redirect plugin
follows the provider's `{ redirect, url }` continuation back to the app.

**Unverified accounts and email codes.** A code sign-in to an account whose
email is not verified runs better-auth's `revokeUnprovenAccountAccess`: it
deletes the account's password, its linked SIWE wallets and its other
sessions, then marks the email verified (passkeys are kept). The code proves
the mailbox; whatever was attached before that proof is not trusted. Password
sign-up is off so that no new unverified email accounts appear. As of
2026-11-16 the only unverified account on the live instance is wallet-only,
which never signs in by email code.

## Teams

**Route:** `src/routes/_authed/org/teams.tsx`

### Create Team

**Component:** `src/components/org/create-team-dialog.tsx`

Input: team name. API: `organization.createTeam({ name })`. Owner/Admin only.

### Team Cards

Grid layout showing name, creation date, member count, and avatar stack (up to 5 members).

### Manage Members

**Component:** `src/components/org/manage-team-members-dialog.tsx`

Checkbox list of org members. Visual indicators: checkmark (existing), `+` (adding), `-` (removing). Batch operations via `addTeamMember`/`removeTeamMember`.

### Default team

The 1.7 plugin creates a team named after the organization when the
organization is created, with the creator as its first member. It is an
ordinary team: owners and admins can add anyone to it, so `team=home` on a
forward-auth middleware (or `home:team:home` in the OIDC claim) does not mean
"the owner". Use `role=admin`, or `home:role:owner` in the OIDC claim, for
that.

## Forward-auth access

Apps behind Traefik/nginx forward auth are authorized against **one**
organization, pinned by id in `FORWARD_AUTH_ORG_ID`. The mechanics (verify
URL parameters, responses, proxy manifests, the trust model) are in
[KUBERNETES.md](./KUBERNETES.md#authorization); this is the admin's view.

**Granting someone access:**

1. **Invite them to the pinned organization** (Members page -> Invite, by
   email or wallet). Once they accept, they are a `member` and can reach every
   app whose middleware carries no `team=` or `role=`.
2. **Add them to a team** (Teams page -> Manage members) for each app whose
   middleware carries `team=<name>`. Team names are matched
   case-insensitively and exactly (`Media` satisfies `team=media`; `media-2`
   does not).
3. Make them **admin** (Members page -> change role) for apps whose middleware
   carries `role=admin`. Owners and admins also pass every `team=` check
   without being in the team.

**Revoking** is the reverse: remove from the team, or from the organization.
`/api/verify` caches membership for up to **30 seconds per replica**, so a
revocation is complete within that window; signing the user out (deleting
their session) is immediate because the session check is never cached.

Users from other organizations - including ones they own - are denied: the
check is on the org id, never the slug.

## Query Caching

**Location:** `src/lib/org-queries.ts`

| Query Key | Function |
|-----------|----------|
| `["organization", orgId, "members"]` | `orgMembersOptions(orgId)` |
| `["organization", orgId, "invitations"]` | `orgInvitationsOptions(orgId)` |
| `["organization", orgId, "full"]` | `orgFullOptions(orgId)` |
| `["organization", orgId, "teams"]` | `orgTeamsOptions(orgId)` |

All queries disabled when no org is selected.

## Client API Reference

```ts
// Organization
organization.create({ name, slug, logo? })
organization.update({ data })
organization.delete({ organizationId })
organization.setActive({ organizationId })
organization.getFullOrganization()

// Members
organization.listMembers()
organization.updateMemberRole({ memberId, role })
organization.removeMember({ memberIdOrEmail })

// Invitations
organization.inviteMember({ email, role, organizationId, walletAddress? })
organization.acceptInvitation({ invitationId })
organization.rejectInvitation({ invitationId })
organization.cancelInvitation({ invitationId })
organization.listInvitations()
organization.getInvitation({ query: { id } })

// Teams
organization.createTeam({ name })
organization.removeTeam({ teamId })
organization.listTeams()
organization.listTeamMembers({ query: { teamId } })
organization.addTeamMember({ teamId, userId })
organization.removeTeamMember({ teamId, userId })
```

## Database Schema

BetterAuth manages these tables (camelCase columns):

- **organization** — `id`, `name`, `slug`, `logo`, `createdAt`
- **member** — `id`, `userId`, `organizationId`, `role`, `teamId`, `createdAt`
- **invitation** — `id`, `email`, `organizationId`, `role`, `status`, `inviterId`, `expiresAt`, `walletAddress`
- **team** — `id`, `name`, `organizationId`, `createdAt`
- **teamMember** — `id`, `teamId`, `userId`, `createdAt` (the table team membership lives in since 1.7; `member.teamId` is legacy and unused)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Invitation acceptance fails for wallet invite | User must SIWE-authenticate with the exact invited wallet address |
| Signup blocked without invitation | `ENABLE_REGISTRATION=false` — user needs a pending invitation matching their email |
| Role change not reflected | Invalidate `["organization", orgId, "members"]` query cache |
| Team member changes not saving | Check for Promise.all errors in batch add/remove operations |
