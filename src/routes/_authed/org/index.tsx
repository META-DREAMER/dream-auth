import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, Mail, UsersRound, Plus } from "lucide-react";
import { authClient, organization } from "@/lib/auth-client";
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

	const { data: fullOrg, isPending: isPendingFull } = useQuery({
		queryKey: [
			"organization",
			activeOrg?.id,
			"full",
		],
		queryFn: async () => {
			if (!activeOrg) return null;
			const result = await organization.getFullOrganization();
			return result.data ?? null;
		},
		enabled: !!activeOrg,
	});

	const { data: membersData } = useQuery({
		queryKey: ["organization", activeOrg?.id, "members"],
		queryFn: async () => {
			if (!activeOrg) return null;
			const result = await organization.listMembers();
			return result.data ?? null;
		},
		enabled: !!activeOrg,
	});

	const { data: teams } = useQuery({
		queryKey: ["organization", activeOrg?.id, "teams"],
		queryFn: async () => {
			if (!activeOrg) return null;
			const result = await organization.listTeams();
			return result.data ?? null;
		},
		enabled: !!activeOrg,
	});

	const { data: invitations } = useQuery({
		queryKey: ["organization", activeOrg?.id, "invitations"],
		queryFn: async () => {
			if (!activeOrg) return null;
			const result = await organization.listInvitations();
			return result.data ?? null;
		},
		enabled: !!activeOrg,
	});

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
		return (
			<div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
					<Building2 className="h-8 w-8 text-zinc-400" />
				</div>
				<h2 className="text-2xl font-semibold text-zinc-100">
					Select an organization to get started
				</h2>
				<p className="text-zinc-400 max-w-md">
					Use the organization switcher in the sidebar to select an organization
					or create a new one.
				</p>
			</div>
		);
	}

	const memberCount = membersData?.members?.length ?? 0;
	const teamCount = teams?.length ?? 0;
	const pendingInvitationsCount =
		invitations?.filter((inv) => inv.status === "pending").length ?? 0;

	const createdDate = fullOrg?.createdAt
		? new Date(fullOrg.createdAt).toLocaleDateString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
			})
		: null;

	return (
		<div className="space-y-6">
			{/* Organization Overview Card */}
			<Card className="bg-zinc-900 border-zinc-800">
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
								<div className="flex h-16 w-16 items-center justify-center rounded-lg bg-emerald-500">
									<Building2 className="h-8 w-8 text-white" />
								</div>
							)}
							<div>
								<CardTitle className="text-zinc-100">{activeOrg.name}</CardTitle>
								<CardDescription className="text-zinc-400">
									{activeOrg.slug}
								</CardDescription>
								{createdDate && (
									<p className="text-xs text-zinc-500 mt-1">
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
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium text-zinc-400">
							Members
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="text-2xl font-bold text-zinc-100">
								{isPendingFull ? (
									<Skeleton className="h-8 w-12" />
								) : (
									memberCount
								)}
							</div>
							<Users className="h-5 w-5 text-zinc-500" />
						</div>
					</CardContent>
				</Card>

				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium text-zinc-400">
							Teams
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="text-2xl font-bold text-zinc-100">
								{isPendingFull ? (
									<Skeleton className="h-8 w-12" />
								) : (
									teamCount
								)}
							</div>
							<UsersRound className="h-5 w-5 text-zinc-500" />
						</div>
					</CardContent>
				</Card>

				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium text-zinc-400">
							Pending Invitations
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="text-2xl font-bold text-zinc-100">
								{isPendingFull ? (
									<Skeleton className="h-8 w-12" />
								) : (
									pendingInvitationsCount
								)}
							</div>
							<Mail className="h-5 w-5 text-zinc-500" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Quick Actions */}
			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader>
					<CardTitle className="text-zinc-100">Quick Actions</CardTitle>
					<CardDescription className="text-zinc-400">
						Common organization management tasks
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-3">
						<Button variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100" disabled>
							<Users className="mr-2 h-4 w-4" />
							Invite Member
						</Button>
						<Button variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100" disabled>
							<Plus className="mr-2 h-4 w-4" />
							Create Team
						</Button>
					</div>
					<p className="text-xs text-zinc-500 mt-2">
						These features will be available once the members and teams pages are implemented.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

