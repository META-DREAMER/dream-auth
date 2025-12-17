import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, Mail, UsersRound, Plus } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
	orgMembersOptions,
	orgInvitationsOptions,
	orgFullOptions,
	orgTeamsOptions,
} from "@/lib/org-queries";
import { formatDateLong } from "@/lib/format";
import { SelectOrgPrompt } from "@/components/org/select-org-prompt";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authed/org/")({
	component: OrgOverview,
});

function OrgOverview() {
	const { data: activeOrg, isPending: isPendingOrg } =
		authClient.useActiveOrganization();

	const { data: fullOrg, isPending: isPendingFull } = useQuery(
		orgFullOptions(activeOrg?.id)
	);

	const { data: membersData } = useQuery(orgMembersOptions(activeOrg?.id));

	const { data: teams } = useQuery(orgTeamsOptions(activeOrg?.id));

	const { data: invitations } = useQuery(orgInvitationsOptions(activeOrg?.id));

	if (isPendingOrg) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-32 w-full" />
				<div className="grid gap-4 md:grid-cols-3">
					<Skeleton className="h-24" />
					<Skeleton className="h-24" />
					<Skeleton className="h-24" />
				</div>
			</div>
		);
	}

	if (!activeOrg) {
		return <SelectOrgPrompt />;
	}

	const memberCount = membersData?.members?.length ?? 0;
	const teamCount = teams?.length ?? 0;
	const pendingInvitationsCount =
		invitations?.filter((inv) => inv.status === "pending").length ?? 0;

	const createdDate = fullOrg?.createdAt
		? formatDateLong(fullOrg.createdAt)
		: null;

	return (
		<div className="space-y-6">
			{/* Organization Overview Card */}
			<Card>
				<CardHeader>
					<div className="flex items-start justify-between">
						<div className="flex items-center gap-4">
							{fullOrg?.logo ? (
								<img
									src={fullOrg.logo}
									alt={activeOrg.name}
									className="h-16 w-16 rounded-lg object-cover"
								/>
							) : (
								<div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary">
									<Building2 className="h-8 w-8 text-primary-foreground" />
								</div>
							)}
							<div>
								<CardTitle>{activeOrg.name}</CardTitle>
								<CardDescription>
									{activeOrg.slug}
								</CardDescription>
								{createdDate && (
									<p className="text-xs text-muted-foreground mt-1">
										Created {createdDate}
									</p>
								)}
							</div>
						</div>
					</div>
				</CardHeader>
			</Card>

			{/* Stats Grid */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Members
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="text-2xl font-bold">
								{isPendingFull ? (
									<Skeleton className="h-8 w-12" />
								) : (
									memberCount
								)}
							</div>
							<Users className="h-5 w-5 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Teams
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="text-2xl font-bold">
								{isPendingFull ? (
									<Skeleton className="h-8 w-12" />
								) : (
									teamCount
								)}
							</div>
							<UsersRound className="h-5 w-5 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Pending Invitations
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="text-2xl font-bold">
								{isPendingFull ? (
									<Skeleton className="h-8 w-12" />
								) : (
									pendingInvitationsCount
								)}
							</div>
							<Mail className="h-5 w-5 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Quick Actions */}
			<Card>
				<CardHeader>
					<CardTitle>Quick Actions</CardTitle>
					<CardDescription>
						Common organization management tasks
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-3">
						<Button variant="outline" disabled>
							<Users className="mr-2 h-4 w-4" />
							Invite Member
						</Button>
						<Button variant="outline" disabled>
							<Plus className="mr-2 h-4 w-4" />
							Create Team
						</Button>
					</div>
					<p className="text-xs text-muted-foreground mt-2">
						These features will be available once the members and teams pages are implemented.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

