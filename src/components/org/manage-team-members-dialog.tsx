import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SpinnerIcon, UserPlusIcon, UserMinusIcon, UsersThreeIcon, CheckIcon } from "@phosphor-icons/react";
import { ErrorAlert } from "@/components/shared/error-alert";
import { DialogHeaderScaffold } from "@/components/shared/dialog-scaffold";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { organization } from "@/lib/auth-client";
import { orgTeamsOptions } from "@/lib/org-queries";

type Team = {
	id: string;
	name: string;
	organizationId: string;
	createdAt: Date;
};

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

interface ManageTeamMembersDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	team: Team;
	orgId: string;
	orgMembers: OrgMember[];
}

export function ManageTeamMembersDialog({
	open,
	onOpenChange,
	team,
	orgId,
	orgMembers,
}: ManageTeamMembersDialogProps) {
	const queryClient = useQueryClient();
	const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
		new Set()
	);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// Fetch current team members
	const { data: teamMembers, isPending: isPendingMembers } = useQuery({
		queryKey: ["organization", orgId, "team", team.id, "members"],
		queryFn: async () => {
			const result = await organization.listTeamMembers({
				query: { teamId: team.id },
			});
			return result.data ?? [];
		},
		enabled: open,
	});

	// Initialize selected members when team members load
	useEffect(() => {
		if (teamMembers) {
			const memberUserIds = new Set(teamMembers.map((m) => m.userId));
			setSelectedUserIds(memberUserIds);
		}
	}, [teamMembers]);

	const addMemberMutation = useMutation({
		mutationFn: async (userId: string) => {
			const result = await organization.addTeamMember({
				teamId: team.id,
				userId,
			});
			if (result.error) {
				throw new Error(result.error.message || "Failed to add member");
			}
			return result;
		},
	});

	const removeMemberMutation = useMutation({
		mutationFn: async (userId: string) => {
			const result = await organization.removeTeamMember({
				teamId: team.id,
				userId,
			});
			if (result.error) {
				throw new Error(result.error.message || "Failed to remove member");
			}
			return result;
		},
	});

	const handleToggleMember = (userId: string) => {
		setSelectedUserIds((prev) => {
			const next = new Set(prev);
			if (next.has(userId)) {
				next.delete(userId);
			} else {
				next.add(userId);
			}
			return next;
		});
	};

	const handleSave = async () => {
		if (!teamMembers) return;

		setSaving(true);
		setError(null);

		try {
			const currentMemberIds = new Set(teamMembers.map((m) => m.userId));

			// Add new members
			const toAdd = [...selectedUserIds].filter(
				(id) => !currentMemberIds.has(id)
			);
			// Remove members
			const toRemove = [...currentMemberIds].filter(
				(id) => !selectedUserIds.has(id)
			);

			// Execute all operations
			await Promise.all([
				...toAdd.map((userId) => addMemberMutation.mutateAsync(userId)),
				...toRemove.map((userId) => removeMemberMutation.mutateAsync(userId)),
			]);

			// Invalidate queries
			queryClient.invalidateQueries({
				queryKey: ["organization", orgId, "team", team.id, "members"],
			});
			queryClient.invalidateQueries({
				queryKey: orgTeamsOptions(orgId).queryKey,
			});

			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to update team members");
		} finally {
			setSaving(false);
		}
	};

	const handleOpenChange = (isOpen: boolean) => {
		onOpenChange(isOpen);
		if (!isOpen) {
			setError(null);
		}
	};

	const currentMemberIds = new Set(teamMembers?.map((m) => m.userId) ?? []);
	const hasChanges =
		[...selectedUserIds].some((id) => !currentMemberIds.has(id)) ||
		[...currentMemberIds].some((id) => !selectedUserIds.has(id));

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeaderScaffold
					icon={UsersThreeIcon}
					title="Manage Team Members"
					description={
						<>
							Add or remove members from{" "}
							<span className="font-medium">{team.name}</span>
						</>
					}
				/>

				<div className="py-4">
					{error && <ErrorAlert message={error} className="mb-4" />}

					{isPendingMembers ? (
						<div className="space-y-3">
							<Skeleton className="h-14 w-full" />
							<Skeleton className="h-14 w-full" />
							<Skeleton className="h-14 w-full" />
						</div>
					) : orgMembers.length === 0 ? (
						<p className="text-center text-muted-foreground py-8">
							No organization members available
						</p>
					) : (
						<ScrollArea className="h-[300px] pr-4">
							<div className="space-y-2">
								{orgMembers.map((member) => (
									<Label
										key={member.userId}
										className="flex items-center gap-3 p-3 rounded-lg bg-muted border cursor-pointer transition-colors hover:bg-muted/80 font-normal"
									>
										<Checkbox
											checked={selectedUserIds.has(member.userId)}
											onCheckedChange={() => handleToggleMember(member.userId)}
										/>
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
										<div className="flex-1 min-w-0">
											<div className="font-medium truncate">
												{member.user.name || "Unknown"}
											</div>
											<div className="text-sm text-muted-foreground truncate">
												{member.user.email}
											</div>
										</div>
										{selectedUserIds.has(member.userId) &&
											currentMemberIds.has(member.userId) && (
												<CheckIcon className="h-4 w-4 text-primary" />
											)}
										{selectedUserIds.has(member.userId) &&
											!currentMemberIds.has(member.userId) && (
												<UserPlusIcon className="h-4 w-4 text-success" />
											)}
										{!selectedUserIds.has(member.userId) &&
											currentMemberIds.has(member.userId) && (
												<UserMinusIcon className="h-4 w-4 text-red-500" />
											)}
									</Label>
								))}
							</div>
						</ScrollArea>
					)}
				</div>

			<DialogFooter className="flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
				<span className="text-sm text-muted-foreground text-center sm:text-left">
					{selectedUserIds.size}{" "}
					{selectedUserIds.size === 1 ? "member" : "members"} selected
				</span>
				<div className="flex flex-col-reverse gap-2 sm:flex-row">
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button
						type="button"
						onClick={handleSave}
						disabled={saving || !hasChanges}
					>
						{saving ? (
							<>
								<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
								Saving...
							</>
						) : (
							"Save Changes"
						)}
					</Button>
				</div>
			</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

