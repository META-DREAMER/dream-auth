import {
	BuildingIcon,
	CaretUpDownIcon,
	CheckIcon,
	PlusIcon,
	SpinnerIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { canCreateOrganizationFn } from "@/lib/org-creation.server";
import { cn } from "@/lib/utils";
import { CreateOrgDialog } from "./create-org-dialog";
import { RoleBadge } from "./role-badge";

export function OrgSwitcher() {
	const { isMobile } = useSidebar();
	const { data: activeOrg } = authClient.useActiveOrganization();
	const { data: organizations } = authClient.useListOrganizations();
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);

	const { data: session } = authClient.useSession();

	// The server enforces this on the create endpoint; here it only decides
	// whether to show the entry. Keyed by user so a later sign-in on the same
	// tab never sees another user's answer, and by the org list since joining
	// or creating an org is what usually changes it. A role change made here
	// invalidates it (`edit-member-role-dialog.tsx`); one made elsewhere shows
	// up within the stale time.
	const { data: canCreate = false } = useQuery({
		queryKey: [
			"organizations",
			"can-create",
			session?.user.id ?? null,
			organizations?.map((org) => org.id) ?? [],
		],
		queryFn: () => canCreateOrganizationFn(),
		staleTime: 1000 * 60 * 5,
	});

	const handleSetActive = async (orgId: string) => {
		setSwitchingOrgId(orgId);
		try {
			await organization.setActive({ organizationId: orgId });
		} finally {
			setSwitchingOrgId(null);
		}
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
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary">
									<BuildingIcon className="size-4 text-primary-foreground" />
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
								<CaretUpDownIcon className="ml-auto" />
							</SidebarMenuButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
							align="start"
							side={isMobile ? "bottom" : "right"}
						>
							<DropdownMenuLabel>Organizations</DropdownMenuLabel>
							{organizations?.map((org) => {
								const isActive = activeOrg?.id === org.id;
								const isSwitching = switchingOrgId === org.id;
								return (
									<DropdownMenuItem
										key={org.id}
										onClick={() => handleSetActive(org.id)}
										disabled={isSwitching || isActive}
										className={cn("gap-2 p-2")}
									>
										<BuildingIcon className="size-4" />
										<span className="flex-1">{org.name}</span>
										{isSwitching ? (
											<SpinnerIcon className="size-4 animate-spin text-muted-foreground" />
										) : isActive ? (
											<CheckIcon className="size-4 text-primary" />
										) : (
											"role" in org && <RoleBadge role={org.role as string} />
										)}
									</DropdownMenuItem>
								);
							})}
							{canCreate && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() => setCreateDialogOpen(true)}
										className="gap-2 p-2"
									>
										<PlusIcon className="size-4" />
										<span>Create Organization</span>
									</DropdownMenuItem>
								</>
							)}
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
