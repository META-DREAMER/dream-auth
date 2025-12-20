---
name: Org Admin Dashboard
overview: Create a feature-complete Organization Dashboard at /org with nested routes using shadcn Sidebar component. Org selector dropdown in sidebar header, navigation for members/invitations/teams/settings. All CRUD via Better Auth organization plugin API with type-safe TanStack Query.
todos:
  - id: enable-teams-backend
    content: Enable teams in organization plugin (auth.ts + auth-client.ts) and run migrations
    status: completed
  - id: add-shadcn-components
    content: Install shadcn sidebar, dropdown-menu, select, avatar, tooltip, collapsible, breadcrumb, separator components
    status: completed
  - id: create-org-layout
    content: Create src/routes/_authed/org.tsx layout route with SidebarProvider and AppSidebar
    status: completed
  - id: create-app-sidebar
    content: Create src/components/org/app-sidebar.tsx with OrgSwitcher in header, nav in content, user in footer
    status: completed
  - id: org-switcher
    content: Create org-switcher.tsx in sidebar header with org list and create new org button
    status: completed
  - id: create-org-index
    content: Create src/routes/_authed/org/index.tsx for org overview or no-org-selected state
    status: completed
  - id: role-badge
    content: Create role-badge.tsx component for consistent role display
    status: completed
  - id: members-page
    content: Create src/routes/_authed/org/members.tsx with list, update role, remove member
    status: completed
  - id: invitations-page
    content: Create src/routes/_authed/org/invitations.tsx with list, invite, cancel, resend
    status: completed
  - id: teams-page
    content: Create src/routes/_authed/org/teams.tsx with team CRUD and member management
    status: completed
  - id: settings-page
    content: Create src/routes/_authed/org/settings.tsx for org edit/delete
    status: completed
  - id: dialog-components
    content: Create dialog components for create org, invite member, edit role, create team, manage team members
    status: completed
  - id: navigation-links
    content: Add Organization Dashboard links to index.tsx and settings.tsx
    status: completed
  - id: final-testing
    content: Test all CRUD operations and verify type safety
    status: in_progress
---

# Organization Dashboard with Sidebar

## Overview

Build a comprehensive organization dashboard at `/org` with nested routes and shadcn Sidebar component. The sidebar contains the org selector dropdown at the top, navigation links in the middle, and user info at the bottom. Child routes provide management for overview, members, invitations, teams, and org settings. Reserved `/admin` for future superadmin functionality.

---

## Architecture

```mermaid
flowchart TD
    subgraph routing [Route Structure - TanStack Router]
        A[/_authed.tsx] --> B[/org.tsx - Layout Route]
        B --> C[/org/index.tsx - Overview]
        B --> D[/org/members.tsx]
        B --> E[/org/invitations.tsx]
        B --> F[/org/teams.tsx]
        B --> G[/org/settings.tsx]
    end

    subgraph sidebar [Sidebar Structure - shadcn]
        H[SidebarProvider] --> I[AppSidebar]
        I --> J[SidebarHeader: OrgSwitcher]
        I --> K[SidebarContent: NavMain]
        I --> L[SidebarFooter: NavUser]
        I --> M[SidebarRail]
    end

    subgraph dialogs [Dialog Components]
        J --> N[CreateOrgDialog]
        D --> O[InviteMemberDialog]
        D --> P[EditMemberRoleDialog]
        F --> Q[CreateTeamDialog]
        F --> R[ManageTeamMembersDialog]
    end

    subgraph api [Better Auth Organization API]
        S[authClient.organization]
        S --> T[create/update/delete org]
        S --> U[listMembers/updateRole/remove]
        S --> V[inviteMember/cancelInvitation]
        S --> W[createTeam/listTeams/addTeamMember]
    end
```

---

## Implementation Plan

### 1. Backend Configuration Updates

**File: [`src/lib/auth.ts`](src/lib/auth.ts)**

Enable teams in the organization plugin:

```typescript
organization({
  teams: {
    enabled: true,
  },
  // ... existing config
});
```

**File: [`src/lib/auth-client.ts`](src/lib/auth-client.ts)**

Enable teams on the client plugin:

```typescript
organizationClient({
  teams: { enabled: true },
  // ... existing schema config
});
```

Then run migrations: `pnpm dlx @better-auth/cli migrate`

---

### 2. Add Required shadcn/ui Components

Install sidebar and dependencies:

```bash
pnpm dlx shadcn@latest add sidebar dropdown-menu select avatar tooltip collapsible breadcrumb separator
```

The sidebar component includes:

- `SidebarProvider` - Context provider, wraps entire layout
- `Sidebar` - Main sidebar container with `collapsible="icon"` option
- `SidebarHeader` - Top section (for OrgSwitcher)
- `SidebarContent` - Middle scrollable section (for navigation)
- `SidebarFooter` - Bottom section (for user menu)
- `SidebarRail` - Resize/collapse handle
- `SidebarInset` - Main content area wrapper
- `SidebarTrigger` - Toggle button for collapse
- `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` - Navigation items
- `useSidebar()` - Hook for sidebar state (isMobile, etc.)

---

### 3. Create Organization Layout Route

**File: `src/routes/_authed/org.tsx`**

Layout route using shadcn sidebar pattern:

```typescript
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/org/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authed/org")({
  component: OrgLayout,
});

function OrgLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {/* Breadcrumb or page title here */}
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

---

### 4. App Sidebar Component

**File: `src/components/org/app-sidebar.tsx`**

Main sidebar following shadcn sidebar-07 pattern:

```typescript
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { OrgSwitcher } from "./org-switcher";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrgSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
```

---

### 5. Organization Switcher (Sidebar Header)

**File: `src/components/org/org-switcher.tsx`**

Dropdown in sidebar header following TeamSwitcher pattern:

```typescript
import { ChevronsUpDown, Plus, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient, organization } from "@/lib/auth-client";
import { RoleBadge } from "./role-badge";

export function OrgSwitcher() {
  const { isMobile } = useSidebar();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { data: organizations } = authClient.useListOrganizations();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleSetActive = async (orgId: string) => {
    await organization.setActive({ organizationId: orgId });
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-500">
                  <Building2 className="size-4 text-white" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {activeOrg?.name ?? "Select Organization"}
                  </span>
                  {activeOrg && (
                    <span className="truncate text-xs text-muted-foreground">
                      {activeOrg.slug}
                    </span>
                  )}
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
              align="start"
              side={isMobile ? "bottom" : "right"}
            >
              <DropdownMenuLabel>Organizations</DropdownMenuLabel>
              {organizations?.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleSetActive(org.id)}
                  className="gap-2 p-2"
                >
                  <Building2 className="size-4" />
                  <span className="flex-1">{org.name}</span>
                  <RoleBadge role={org.role} />
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setCreateDialogOpen(true)}
                className="gap-2 p-2"
              >
                <Plus className="size-4" />
                <span>Create Organization</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <CreateOrgDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
```

---

### 6. Navigation Component

**File: `src/components/org/nav-main.tsx`**

Navigation menu for org sections:

```typescript
import { Link, useLocation } from "@tanstack/react-router";
import { Building2, Users, Mail, UsersRound, Settings } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  { href: "/org", label: "Overview", icon: Building2 },
  { href: "/org/members", label: "Members", icon: Users },
  { href: "/org/invitations", label: "Invitations", icon: Mail },
  { href: "/org/teams", label: "Teams", icon: UsersRound },
  { href: "/org/settings", label: "Settings", icon: Settings },
];

export function NavMain() {
  const location = useLocation();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Organization</SidebarGroupLabel>
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={location.pathname === item.href}
              tooltip={item.label}
            >
              <Link to={item.href}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
```

---

### 7. User Menu (Sidebar Footer)

**File: `src/components/org/nav-user.tsx`**

User dropdown in sidebar footer:

```typescript
import { ChevronsUpDown, LogOut, Settings, User } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSession } from "@/lib/auth-client";
import { useSignOut } from "@/hooks/use-sign-out";

export function NavUser() {
  const { isMobile } = useSidebar();
  const { data: session } = useSession();
  const handleSignOut = useSignOut();

  if (!session) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {session.user.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {session.user.name}
                </span>
                <span className="truncate text-xs">{session.user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
          >
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="mr-2" /> Account Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
```

---

### 8. Child Route Pages

#### **Overview Page** (`src/routes/_authed/org/index.tsx`)

Two states based on `useActiveOrganization()`:

**No Active Org:**

- Message: "Select an organization to get started"
- Points to sidebar org switcher dropdown

**Active Org Selected:**

- Organization overview card: name, slug, logo, created date
- Stats: member count, team count, pending invitations
- Quick action buttons: Invite Member, Create Team

#### **Members Page** (`src/routes/_authed/org/members.tsx`)

| Feature | API Method |

|---------|------------|

| List members | `organization.listMembers()` |

| Update role | `organization.updateMemberRole()` |

| Remove member | `organization.removeMember()` |

UI: Table with Avatar, Name, Email, Role (with RoleBadge), Joined date, Actions

#### **Invitations Page** (`src/routes/_authed/org/invitations.tsx`)

| Feature | API Method |

|---------|------------|

| List invitations | `organization.listInvitations()` |

| Invite by email | `organization.inviteMember()` |

| Invite by wallet | `inviteByWallet()` helper |

| Cancel | `organization.cancelInvitation()` |

| Resend | `organization.inviteMember({ resend: true })` |

UI: Table with Email/Wallet, Role, Status badge, Expires, Actions

#### **Teams Page** (`src/routes/_authed/org/teams.tsx`)

| Feature | API Method |

|---------|------------|

| List teams | `organization.listTeams()` |

| Create team | `organization.createTeam()` |

| Remove team | `organization.removeTeam()` |

| Manage members | `addTeamMember()` / `removeTeamMember()` |

UI: Grid of team cards with member avatars, expandable member list

#### **Settings Page** (`src/routes/_authed/org/settings.tsx`)

| Feature | API Method |

|---------|------------|

| Get org | `organization.getFullOrganization()` |

| Update org | `organization.update()` |

| Delete org | `organization.delete()` |

UI: Form with Name, Slug, Logo URL + Danger zone for delete

---

### 9. Dialog Components

| Dialog | Purpose |

|--------|---------|

| `create-org-dialog.tsx` | Name, slug (auto-generated), logo URL |

| `invite-member-dialog.tsx` | Email/wallet toggle, role selector |

| `edit-member-role-dialog.tsx` | Role dropdown |

| `create-team-dialog.tsx` | Team name input |

| `manage-team-members-dialog.tsx` | Checkbox list of org members |

---

### 10. Role Badge Component

**File: `src/components/org/role-badge.tsx`**

```typescript
import { Badge } from "@/components/ui/badge";

const roleStyles = {
  owner: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  admin: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  member: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

export function RoleBadge({ role }: { role: string }) {
  const style =
    roleStyles[role as keyof typeof roleStyles] ?? roleStyles.member;
  return (
    <Badge variant="outline" className={style}>
      {role}
    </Badge>
  );
}
```

---

### 11. Navigation Updates

**File: [`src/routes/index.tsx`](src/routes/index.tsx)**

Add "Organizations" button to authenticated home view:

```typescript
<Button asChild>
  <Link to="/org">
    <Building2 className="mr-2 h-4 w-4" />
    Organizations
  </Link>
</Button>
```

**File: [`src/routes/_authed/settings.tsx`](src/routes/_authed/settings.tsx)**

Add link in header area.

---

## File Structure

```
src/
├── routes/
│   └── _authed/
│       ├── org.tsx                    # Layout route with SidebarProvider
│       └── org/
│           ├── index.tsx              # Overview / no-org state
│           ├── members.tsx            # Members management
│           ├── invitations.tsx        # Invitations management
│           ├── teams.tsx              # Teams management
│           └── settings.tsx           # Org settings & delete
└── components/
    └── org/
        ├── app-sidebar.tsx            # Main sidebar component
        ├── org-switcher.tsx           # Org dropdown in sidebar header
        ├── nav-main.tsx               # Navigation menu
        ├── nav-user.tsx               # User menu in footer
        ├── role-badge.tsx             # Role display badge
        ├── create-org-dialog.tsx      # Create organization
        ├── invite-member-dialog.tsx   # Invite by email/wallet
        ├── edit-member-role-dialog.tsx # Change member role
        ├── create-team-dialog.tsx     # Create team
        └── manage-team-members-dialog.tsx # Team member management
```

---

## Key Implementation Details

### shadcn Sidebar Key Concepts

1. **SidebarProvider** must wrap the entire layout (both sidebar and content)
2. **Sidebar** component accepts `collapsible="icon"` to collapse to icons only
3. **SidebarInset** wraps the main content area
4. **SidebarTrigger** provides collapse/expand toggle button
5. **useSidebar()** hook provides `isMobile` for responsive dropdown positioning
6. **SidebarMenuButton** accepts `tooltip` prop for collapsed state tooltips
7. **SidebarMenuButton** accepts `isActive` prop for active state styling

### Type Safety

```typescript
// Types inferred from Better Auth
type Organization = NonNullable<
  Awaited<
    ReturnType<typeof authClient.organization.getFullOrganization>
  >["data"]
>;
type Member = NonNullable<
  Awaited<ReturnType<typeof authClient.organization.listMembers>>["data"]
>[number];
```

### Query Keys

```typescript
export const orgKeys = {
  all: ["organizations"] as const,
  active: ["organization", "active"] as const,
  full: (orgId: string) => ["organization", orgId, "full"] as const,
  members: (orgId: string) => ["organization", orgId, "members"] as const,
  invitations: (orgId: string) =>
    ["organization", orgId, "invitations"] as const,
  teams: (orgId: string) => ["organization", orgId, "teams"] as const,
};
```

### Guarding Routes Without Active Org

Each child route checks for active org:

```typescript
function MembersPage() {
  const { data: activeOrg, isPending } = authClient.useActiveOrganization();

  if (isPending) return <PageSkeleton />;
  if (!activeOrg) return <SelectOrgPrompt />;

  return <MembersList orgId={activeOrg.id} />;
}
```

---

## Migration Requirements

After enabling teams in auth.ts, run:

```bash
pnpm dlx @better-auth/cli migrate
```

This adds the `team` and `teamMember` tables to the database.