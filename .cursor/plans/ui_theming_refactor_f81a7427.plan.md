---
name: UI Theming Refactor
overview: Refactor the codebase to leverage shadcn/ui's CSS variable theming system properly, replacing hardcoded Tailwind color classes with theme variables and adding new component variants where patterns repeat across the app.
todos:
  - id: update-css-vars
    content: Add --success and --success-foreground CSS variables to styles.css
    status: completed
  - id: update-error-alert
    content: Update error-alert.tsx to use --destructive CSS variable
    status: completed
  - id: update-table-component
    content: Update table.tsx TableHead to use text-muted-foreground by default
    status: completed
  - id: clean-login-route
    content: Remove hardcoded colors from login.tsx, use theme defaults
    status: completed
  - id: clean-register-route
    content: Remove hardcoded colors from register.tsx, use theme defaults
    status: completed
  - id: clean-index-route
    content: Remove hardcoded colors from index.tsx, use theme defaults
    status: completed
  - id: clean-settings-route
    content: Remove hardcoded colors from _authed/settings.tsx
    status: completed
  - id: clean-org-routes
    content: Clean up all org routes (members, teams, invitations, settings, index)
    status: completed
  - id: clean-auth-components
    content: Clean up all auth dialog components (9 files)
    status: completed
  - id: clean-org-components
    content: Clean up org components (create-org, invite-member, create-team, etc.)
    status: completed
  - id: clean-shared-components
    content: Clean up shared components and simplify page-background
    status: completed
  - id: clean-other-routes
    content: Clean up consent.tsx, invite.$id.tsx
    status: completed
  - id: verification
    content: Run grep verification to confirm hardcoded colors removed
    status: completed
---

# UI Theming Refactor Plan

## Problem Summary

The codebase has **418 occurrences** of hardcoded zinc colors (`border-zinc-*`, `bg-zinc-*`, `text-zinc-*`) across 34 files, plus **47 gradient usages** and **47 emerald color** occurrences. This makes theming difficult and creates inconsistent styling.

**Common patterns that need cleanup:**

1. **Buttons with identical overrides** (appears 15+ times):
```tsx
className="border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
```

2. **Inputs with identical styling** (appears 10+ times):
```tsx
className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500"
```

3. **Dialog/Card backgrounds** (appears 20+ times):
```tsx
className="bg-zinc-900 border-zinc-800"
```

4. **Gradient primary buttons** (appears 10+ times):
```tsx
className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
```

5. **Page backgrounds with gradients** (appears in every route)

---

## Implementation Strategy

### Phase 1: Update CSS Variables in [styles.css](src/styles.css)

The existing variables are already well-structured. We only need to add a few semantic variables for specific use cases:

- `--success` / `--success-foreground` - for verified badges, success states (currently using emerald)

### Phase 2: Update shadcn/ui Components

Update components in [`src/components/ui/`](src/components/ui/) to properly use theme variables and work out-of-the-box without overrides:

**Files to modify:**

- [`button.tsx`](src/components/ui/button.tsx) - Already good, but may add custom variants if needed
- [`card.tsx`](src/components/ui/card.tsx) - Already uses `bg-card`, no changes needed
- [`dialog.tsx`](src/components/ui/dialog.tsx) - Already uses `bg-background`, no changes needed
- [`input.tsx`](src/components/ui/input.tsx) - Already uses theme variables, no changes needed
- [`label.tsx`](src/components/ui/label.tsx) - Already minimal, no changes needed
- [`tabs.tsx`](src/components/ui/tabs.tsx) - Already uses `bg-muted`, no changes needed
- [`table.tsx`](src/components/ui/table.tsx) - Add `text-muted-foreground` for headers
- [`dropdown-menu.tsx`](src/components/ui/dropdown-menu.tsx) - Already uses theme variables
- [`alert-dialog.tsx`](src/components/ui/alert-dialog.tsx) - Already uses `bg-background`

The shadcn/ui components are already properly themed. The issue is that **routes and feature components override them unnecessarily**.

### Phase 3: Clean Up Route & Feature Components

Remove hardcoded color overrides from all routes and components. The components should work with just variant props.

**High-impact files (most overrides):**

- [`src/routes/login.tsx`](src/routes/login.tsx) - 11 zinc references
- [`src/routes/register.tsx`](src/routes/register.tsx) - 17 zinc references  
- [`src/routes/index.tsx`](src/routes/index.tsx) - 16 zinc references
- [`src/routes/_authed/settings.tsx`](src/routes/_authed/settings.tsx) - 29 zinc references
- [`src/routes/_authed/org/members.tsx`](src/routes/_authed/org/members.tsx) - 28 zinc references

**Auth components:**

- [`src/components/auth/add-passkey-dialog.tsx`](src/components/auth/add-passkey-dialog.tsx)
- [`src/components/auth/link-email-dialog.tsx`](src/components/auth/link-email-dialog.tsx)
- [`src/components/auth/change-email-dialog.tsx`](src/components/auth/change-email-dialog.tsx)
- [`src/components/auth/verify-email-dialog.tsx`](src/components/auth/verify-email-dialog.tsx)
- [`src/components/auth/link-wallet-dialog.tsx`](src/components/auth/link-wallet-dialog.tsx)
- [`src/components/auth/passkey-list.tsx`](src/components/auth/passkey-list.tsx)
- [`src/components/auth/wallet-list.tsx`](src/components/auth/wallet-list.tsx)
- [`src/components/auth/connect-siwe-button.tsx`](src/components/auth/connect-siwe-button.tsx)
- [`src/components/auth/email-otp-input.tsx`](src/components/auth/email-otp-input.tsx)

**Org components:**

- [`src/components/org/create-org-dialog.tsx`](src/components/org/create-org-dialog.tsx)
- [`src/components/org/invite-member-dialog.tsx`](src/components/org/invite-member-dialog.tsx)
- [`src/components/org/create-team-dialog.tsx`](src/components/org/create-team-dialog.tsx)
- [`src/components/org/manage-team-members-dialog.tsx`](src/components/org/manage-team-members-dialog.tsx)
- [`src/components/org/edit-member-role-dialog.tsx`](src/components/org/edit-member-role-dialog.tsx)
- [`src/components/org/role-select.tsx`](src/components/org/role-select.tsx)

**Org routes:**

- [`src/routes/_authed/org/index.tsx`](src/routes/_authed/org/index.tsx)
- [`src/routes/_authed/org/invitations.tsx`](src/routes/_authed/org/invitations.tsx)
- [`src/routes/_authed/org/settings.tsx`](src/routes/_authed/org/settings.tsx)
- [`src/routes/_authed/org/teams.tsx`](src/routes/_authed/org/teams.tsx)

**Other:**

- [`src/routes/consent.tsx`](src/routes/consent.tsx)
- [`src/routes/invite.$id.tsx`](src/routes/invite.$id.tsx)
- [`src/components/shared/page-background.tsx`](src/components/shared/page-background.tsx) - Remove or simplify
- [`src/components/shared/delete-confirm-dialog.tsx`](src/components/shared/delete-confirm-dialog.tsx)
- [`src/components/shared/list-states.tsx`](src/components/shared/list-states.tsx)

### Phase 4: Keep Semantic Color Components As-Is

These components use semantic colors intentionally and should remain unchanged:

- [`src/components/org/role-badge.tsx`](src/components/org/role-badge.tsx) - Uses violet/blue/zinc for role distinction
- [`src/components/org/status-badge.tsx`](src/components/org/status-badge.tsx) - Uses amber/emerald/red for status
- [`src/components/shared/error-alert.tsx`](src/components/shared/error-alert.tsx) - Uses red for errors (but could use destructive variable)

---

## Key Changes Per Component Type

### Buttons

| Current | After |

|---------|-------|

| `className="border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"` | `variant="outline"` |

| `className="bg-gradient-to-r from-emerald-500 to-cyan-500 ..."` | `variant="default"` (primary) |

| `className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"` | `variant="secondary"` |

### Cards/Dialogs

| Current | After |

|---------|-------|

| `className="bg-zinc-900 border-zinc-800"` | No className (uses theme defaults) |

| `className="bg-zinc-900/80 backdrop-blur-sm border-zinc-800"` | No className |

### Text Elements

| Current | After |

|---------|-------|

| `className="text-zinc-100"` | `className="text-foreground"` or remove |

| `className="text-zinc-400"` | `className="text-muted-foreground"` |

| `className="text-zinc-300"` | Remove (inherits foreground) |

| `className="text-zinc-500"` | `className="text-muted-foreground"` |

### Inputs

Remove all custom styling - the base Input component handles it via theme variables.

### Page Backgrounds

| Current | After |

|---------|-------|

| `bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950` | `bg-background` |

---

## Verification

After refactoring, run a grep to verify cleanup:

```bash
rg "zinc-[0-9]" src/ --count  # Should be minimal (only in semantic badge components)
rg "emerald-[0-9]" src/ --count  # Should be minimal (only in semantic components)
rg "bg-gradient" src/ --count  # Should be zero or minimal
```