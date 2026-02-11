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

### Settings

**Route:** `src/routes/_authed/org/settings.tsx`

Owner/Admin can edit name, slug, and logo. Owner can delete (requires typing org name to confirm).

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

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Invitation acceptance fails for wallet invite | User must SIWE-authenticate with the exact invited wallet address |
| Signup blocked without invitation | `ENABLE_REGISTRATION=false` — user needs a pending invitation matching their email |
| Role change not reflected | Invalidate `["organization", orgId, "members"]` query cache |
| Team member changes not saving | Check for Promise.all errors in batch add/remove operations |
