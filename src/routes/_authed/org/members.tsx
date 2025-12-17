import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Loader2, MoreVertical, Shield, UserMinus } from "lucide-react";
import { authClient, organization, useSession } from "@/lib/auth-client";
import { orgMembersOptions } from "@/lib/org-queries";
import { formatDate } from "@/lib/format";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { SelectOrgPrompt } from "@/components/org/select-org-prompt";
import { PageHeader } from "@/components/org/page-header";
import { RoleSelect } from "@/components/org/role-select";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { RoleBadge } from "@/components/org/role-badge";

export const Route = createFileRoute("/_authed/org/members")({
	component: MembersPage,
});

type Member = {
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

function MembersPage() {
	const { data: activeOrg, isPending: isPendingOrg } =
		authClient.useActiveOrganization();
	const { data: session } = useSession();
	const queryClient = useQueryClient();
	const { isOwnerOrAdmin } = useOrgPermissions();

	const [editMember, setEditMember] = useState<Member | null>(null);
	const [editRole, setEditRole] = useState<string>("");
	const [removeMember, setRemoveMember] = useState<Member | null>(null);

	const { data: membersData, isPending: isPendingMembers } = useQuery(
		orgMembersOptions(activeOrg?.id)
	);

	const updateRoleMutation = useMutation({
		mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
			return organization.updateMemberRole({
				memberId,
				role: role as "member" | "admin" | "owner",
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orgMembersOptions(activeOrg?.id).queryKey,
			});
			setEditMember(null);
		},
	});

	const removeMemberMutation = useMutation({
		mutationFn: async (memberId: string) => {
			return organization.removeMember({ memberIdOrEmail: memberId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orgMembersOptions(activeOrg?.id).queryKey,
			});
			setRemoveMember(null);
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

	const members = membersData?.members ?? [];

	const handleEditRole = (member: Member) => {
		setEditMember(member);
		setEditRole(member.role);
	};

	const handleSaveRole = () => {
		if (editMember && editRole) {
			updateRoleMutation.mutate({
				memberId: editMember.id,
				role: editRole,
			});
		}
	};

	const handleRemoveMember = () => {
		if (removeMember) {
			removeMemberMutation.mutate(removeMember.id);
		}
	};

	return (
		<div className="space-y-6">
			<PageHeader
				title="Members"
				description={`Manage members of ${activeOrg.name}`}
			/>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Users className="h-5 w-5" />
						Organization Members
					</CardTitle>
					<CardDescription>
						{members.length} {members.length === 1 ? "member" : "members"} in
						this organization
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isPendingMembers ? (
						<div className="space-y-4">
							{[...Array(3)].map((_, i) => (
								<Skeleton key={i} className="h-16 w-full" />
							))}
						</div>
					) : members.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							No members found
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead>Member</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Joined</TableHead>
									{isOwnerOrAdmin && (
										<TableHead className="text-right">
											Actions
										</TableHead>
									)}
								</TableRow>
							</TableHeader>
							<TableBody>
								{members.map((member) => {
									const isCurrentUser = member.userId === session?.user?.id;
									const isOwner = member.role === "owner";
									const canModify = isOwnerOrAdmin && !isCurrentUser;

									return (
										<TableRow key={member.id}>
											<TableCell>
												<div className="flex items-center gap-3">
													<Avatar className="h-9 w-9">
														{member.user.image && (
															<AvatarImage src={member.user.image} />
														)}
														<AvatarFallback>
															{member.user.name?.charAt(0).toUpperCase() ||
																member.user.email?.charAt(0).toUpperCase() ||
																"?"}
														</AvatarFallback>
													</Avatar>
													<div>
														<div className="font-medium">
															{member.user.name || "Unknown"}
															{isCurrentUser && (
																<span className="ml-2 text-xs text-muted-foreground">
																	(you)
																</span>
															)}
														</div>
														<div className="text-sm text-muted-foreground">
															{member.user.email}
														</div>
													</div>
												</div>
											</TableCell>
											<TableCell>
												<RoleBadge role={member.role} />
											</TableCell>
											<TableCell className="text-muted-foreground">
												{formatDate(member.createdAt)}
											</TableCell>
											{isOwnerOrAdmin && (
												<TableCell className="text-right">
													{canModify && (
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-8 w-8"
																>
																	<MoreVertical className="h-4 w-4" />
																</Button>
															</DropdownMenuTrigger>
															<DropdownMenuContent align="end">
																{!isOwner && (
																	<DropdownMenuItem
																		onClick={() => handleEditRole(member)}
																	>
																		<Shield className="mr-2 h-4 w-4" />
																		Change Role
																	</DropdownMenuItem>
																)}
																<DropdownMenuSeparator />
																<DropdownMenuItem
																	onClick={() => setRemoveMember(member)}
																	className="text-destructive focus:text-destructive"
																>
																	<UserMinus className="mr-2 h-4 w-4" />
																	Remove Member
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													)}
												</TableCell>
											)}
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			{/* Edit Role Dialog */}
			<Dialog open={!!editMember} onOpenChange={() => setEditMember(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Change Member Role</DialogTitle>
						<DialogDescription>
							Update the role for {editMember?.user.name || editMember?.user.email}
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<RoleSelect
							value={editRole}
							onValueChange={setEditRole}
							showDescriptions
						/>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setEditMember(null)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleSaveRole}
							disabled={updateRoleMutation.isPending || !editRole}
						>
							{updateRoleMutation.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Save Changes
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Remove Member Confirmation */}
			<AlertDialog open={!!removeMember} onOpenChange={() => setRemoveMember(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Remove Member
						</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to remove{" "}
							<span className="font-medium text-foreground">
								{removeMember?.user.name || removeMember?.user.email}
							</span>{" "}
							from this organization? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleRemoveMember}
							disabled={removeMemberMutation.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{removeMemberMutation.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Remove Member
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
