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

Standard flow — user signs up or links existing account.

### Wallet Invitations

```ts
inviteByWallet(walletAddress, role, organizationId)
```

Generates deterministic email `{walletAddress}@{auth-domain}`. Stores `walletAddress` on invitation record. See [WEB3.md](./WEB3.md) for wallet verification details.

**Helpers:** `src/lib/invite-helpers.ts` — `getWalletEmail()`, `isWalletInvitation()`, `getInvitationWalletAddress()`

### Invitation Page

**Route:** `src/routes/invite.$id.tsx`

1. **Public preview** (no auth): org name, role, expiration, wallet requirement
2. **Authenticated view**: full details, accept/decline buttons
3. **Wallet validation**: verifies connected wallet matches invitation

The public preview uses a direct DB query (exception to "prefer `auth.api`" rule — pre-auth access needed).

### Invitation Lifecycle

| Status | Description |
|--------|-------------|
| `pending` | Active, waiting for response |
| `accepted` | User joined the organization |
| `rejected` | User declined |
| `canceled` | Admin/owner canceled |

**Expiration:** 7 days. Resending cancels the old invitation and creates a new one.

### Wallet Verification Hook

**Location:** `src/lib/auth.ts` (`beforeAcceptInvitation`)

For wallet invitations, validates the accepting user has a SIWE account matching the invited wallet address. Throws `APIError("FORBIDDEN")` on mismatch.

### Invitation-Only Registration

When `ENABLE_REGISTRATION=false`, the `databaseHooks.user.create.before` hook checks for a pending invitation matching the user's email. Signups without invitations are blocked with `APIError("FORBIDDEN")`.

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
organization is created, with the creator as its only member. It shows up
like any other team, so `team=home` on a forward-auth middleware (or
`home:team:home` in the OIDC claim) effectively means "the owner".

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
