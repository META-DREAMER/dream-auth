import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	UsersRound,
	Loader2,
	Plus,
	MoreVertical,
	Trash2,
	UserPlus,
	Users,
} from "lucide-react";
import { authClient, organization } from "@/lib/auth-client";
import { orgTeamsOptions, orgMembersOptions } from "@/lib/org-queries";
import { formatDate } from "@/lib/format";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { SelectOrgPrompt } from "@/components/org/select-org-prompt";
import { PageHeader } from "@/components/org/page-header";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateTeamDialog } from "@/components/org/create-team-dialog";
import { ManageTeamMembersDialog } from "@/components/org/manage-team-members-dialog";

export const Route = createFileRoute("/_authed/org/teams")({
	component: TeamsPage,
});

type Team = {
	id: string;
	name: string;
	organizationId: string;
	createdAt: Date;
};

function TeamsPage() {
	const { data: activeOrg, isPending: isPendingOrg } =
		authClient.useActiveOrganization();
	const queryClient = useQueryClient();
	const { isOwnerOrAdmin } = useOrgPermissions();

	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [manageTeam, setManageTeam] = useState<Team | null>(null);
	const [deleteTeam, setDeleteTeam] = useState<Team | null>(null);

	const { data: teams, isPending: isPendingTeams } = useQuery(
		orgTeamsOptions(activeOrg?.id)
	);

	const { data: membersData } = useQuery(orgMembersOptions(activeOrg?.id));

	const deleteTeamMutation = useMutation({
		mutationFn: async (teamId: string) => {
			return organization.removeTeam({ teamId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orgTeamsOptions(activeOrg?.id).queryKey,
			});
			setDeleteTeam(null);
		},
	});

	if (isPendingOrg) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-10 w-48" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	if (!activeOrg) {
		return <SelectOrgPrompt />;
	}

	const handleDeleteTeam = () => {
		if (deleteTeam) {
			deleteTeamMutation.mutate(deleteTeam.id);
		}
	};

	const teamList = teams ?? [];
	const members = membersData?.members ?? [];

	return (
		<div className="space-y-6">
			<PageHeader
				title="Teams"
				description={`Organize members of ${activeOrg.name} into teams`}
				action={
					isOwnerOrAdmin ? (
						<Button
							onClick={() => setCreateDialogOpen(true)}
							className="bg-emerald-600 hover:bg-emerald-700"
						>
							<Plus className="mr-2 h-4 w-4" />
							Create Team
						</Button>
					) : undefined
				}
			/>

			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader>
					<CardTitle className="text-zinc-100 flex items-center gap-2">
						<UsersRound className="h-5 w-5" />
						Organization Teams
					</CardTitle>
					<CardDescription className="text-zinc-400">
						{teamList.length} {teamList.length === 1 ? "team" : "teams"} in this
						organization
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isPendingTeams ? (
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{[...Array(3)].map((_, i) => (
								<Skeleton key={i} className="h-48 w-full" />
							))}
						</div>
					) : teamList.length === 0 ? (
						<div className="text-center py-12">
							<UsersRound className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
							<p className="text-zinc-400 mb-2">No teams yet</p>
							<p className="text-sm text-zinc-500 mb-4">
								Create teams to organize members and manage access
							</p>
							{isOwnerOrAdmin && (
								<Button
									onClick={() => setCreateDialogOpen(true)}
									variant="outline"
									className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
								>
									<Plus className="mr-2 h-4 w-4" />
									Create First Team
								</Button>
							)}
						</div>
					) : (
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{teamList.map((team) => (
								<TeamCard
									key={team.id}
									team={team}
									isOwnerOrAdmin={isOwnerOrAdmin}
									orgMembers={members}
									onManage={() => setManageTeam(team)}
									onDelete={() => setDeleteTeam(team)}
								/>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Create Team Dialog */}
			<CreateTeamDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				orgId={activeOrg.id}
			/>

			{/* Manage Team Members Dialog */}
			{manageTeam && (
				<ManageTeamMembersDialog
					open={!!manageTeam}
					onOpenChange={(open) => !open && setManageTeam(null)}
					team={manageTeam}
					orgId={activeOrg.id}
					orgMembers={members}
				/>
			)}

			{/* Delete Team Confirmation */}
			<AlertDialog open={!!deleteTeam} onOpenChange={() => setDeleteTeam(null)}>
				<AlertDialogContent className="bg-zinc-900 border-zinc-800">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-zinc-100">
							Delete Team
						</AlertDialogTitle>
						<AlertDialogDescription className="text-zinc-400">
							Are you sure you want to delete the team{" "}
							<span className="font-medium text-zinc-300">
								{deleteTeam?.name}
							</span>
							? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteTeam}
							disabled={deleteTeamMutation.isPending}
							className="bg-red-500 text-white hover:bg-red-600"
						>
							{deleteTeamMutation.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Delete Team
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

type OrgMember = {
	id: string;
	userId: string;
	organizationId: string;
	role: string;
	createdAt: Date;
	user: {
		id: string;
		name: string;
		email: string;
		image?: string | null;
	};
};

interface TeamCardProps {
	team: Team;
	isOwnerOrAdmin: boolean;
	orgMembers: OrgMember[];
	onManage: () => void;
	onDelete: () => void;
}

function TeamCard({
	team,
	isOwnerOrAdmin,
	orgMembers,
	onManage,
	onDelete,
}: TeamCardProps) {
	const { data: activeOrg } = authClient.useActiveOrganization();
	const { data: teamMembers, isPending } = useQuery({
		queryKey: ["organization", activeOrg?.id, "team", team.id, "members"],
		queryFn: async () => {
			const result = await organization.listTeamMembers({
				query: { teamId: team.id },
			});
			return result.data ?? [];
		},
		enabled: !!activeOrg?.id,
	});

	const memberCount = teamMembers?.length ?? 0;

	// Create a lookup map from userId to org member
	const orgMemberMap = new Map(orgMembers.map((m) => [m.userId, m]));

	// Get team members with user details from org members
	const teamMembersWithDetails = teamMembers?.map((tm) => ({
		...tm,
		orgMember: orgMemberMap.get(tm.userId),
	}));

	return (
		<Card className="bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 transition-colors">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
							<UsersRound className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-zinc-100 text-base">
								{team.name}
							</CardTitle>
							<CardDescription className="text-zinc-500 text-xs">
								Created {formatDate(team.createdAt)}
							</CardDescription>
						</div>
					</div>
					{isOwnerOrAdmin && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
								>
									<MoreVertical className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="bg-zinc-900 border-zinc-800"
							>
								<DropdownMenuItem
									onClick={onManage}
									className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
								>
									<UserPlus className="mr-2 h-4 w-4" />
									Manage Members
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={onDelete}
									className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete Team
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<div className="flex items-center gap-2 text-sm text-zinc-400 mb-3">
					<Users className="h-4 w-4" />
					<span>
						{isPending ? "..." : memberCount}{" "}
						{memberCount === 1 ? "member" : "members"}
					</span>
				</div>

				{isPending ? (
					<div className="flex gap-1">
						{[...Array(3)].map((_, i) => (
							<Skeleton key={i} className="h-8 w-8 rounded-full" />
						))}
					</div>
				) : memberCount > 0 ? (
					<div className="flex -space-x-2">
						{teamMembersWithDetails?.slice(0, 5).map((member) => (
							<Avatar
								key={member.id}
								className="h-8 w-8 border-2 border-zinc-800"
							>
								<AvatarFallback className="bg-zinc-700 text-zinc-300 text-xs">
									{member.orgMember?.user.name?.charAt(0).toUpperCase() ||
										member.orgMember?.user.email?.charAt(0).toUpperCase() ||
										"?"}
								</AvatarFallback>
							</Avatar>
						))}
						{memberCount > 5 && (
							<div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 border-2 border-zinc-800 text-xs text-zinc-300">
								+{memberCount - 5}
							</div>
						)}
					</div>
				) : (
					<p className="text-xs text-zinc-500">No members yet</p>
				)}

				{isOwnerOrAdmin && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onManage}
						className="w-full mt-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
					>
						<UserPlus className="mr-2 h-4 w-4" />
						Manage Members
					</Button>
				)}
			</CardContent>
		</Card>
	);
}
