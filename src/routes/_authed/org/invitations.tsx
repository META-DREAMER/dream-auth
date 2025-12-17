import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Mail,
	Loader2,
	Plus,
	MoreVertical,
	XCircle,
	RefreshCw,
	Wallet,
} from "lucide-react";
import { authClient, organization } from "@/lib/auth-client";
import { inviteByEmail, inviteByWallet, isWalletInvitation } from "@/lib/invite-helpers";
import { orgInvitationsOptions } from "@/lib/org-queries";
import { formatDate } from "@/lib/format";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { SelectOrgPrompt } from "@/components/org/select-org-prompt";
import { PageHeader } from "@/components/org/page-header";
import { RoleSelect } from "@/components/org/role-select";
import { StatusBadge } from "@/components/org/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleBadge } from "@/components/org/role-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authed/org/invitations")({
	component: InvitationsPage,
});

type Invitation = {
	id: string;
	email: string;
	role: string;
	status: string;
	expiresAt: Date;
	organizationId: string;
	inviterId: string;
	walletAddress?: string | null;
};

function InvitationsPage() {
	const { data: activeOrg, isPending: isPendingOrg } =
		authClient.useActiveOrganization();
	const queryClient = useQueryClient();
	const { isOwnerOrAdmin } = useOrgPermissions();

	const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
	const [cancelInvitation, setCancelInvitation] = useState<Invitation | null>(null);
	const [inviteType, setInviteType] = useState<"email" | "wallet">("email");
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteWallet, setInviteWallet] = useState("");
	const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
	const [resendingId, setResendingId] = useState<string | null>(null);

	const { data: invitations, isPending: isPendingInvitations } = useQuery(
		orgInvitationsOptions(activeOrg?.id)
	);

	const inviteMutation = useMutation({
		mutationFn: async ({
			type,
			value,
			role,
		}: {
			type: "email" | "wallet";
			value: string;
			role: "member" | "admin";
		}) => {
			if (!activeOrg) throw new Error("No active organization");
			if (type === "email") {
				return inviteByEmail(value, role, activeOrg.id);
			}
			return inviteByWallet(value, role, activeOrg.id);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orgInvitationsOptions(activeOrg?.id).queryKey,
			});
			setInviteDialogOpen(false);
			setInviteEmail("");
			setInviteWallet("");
			setInviteRole("member");
		},
	});

	const cancelMutation = useMutation({
		mutationFn: async (invitationId: string) => {
			return organization.cancelInvitation({ invitationId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orgInvitationsOptions(activeOrg?.id).queryKey,
			});
			setCancelInvitation(null);
		},
	});

	const resendMutation = useMutation({
		mutationFn: async (invitation: Invitation) => {
			setResendingId(invitation.id);
			// First cancel the old invitation, then create a new one
			await organization.cancelInvitation({ invitationId: invitation.id });
			if (isWalletInvitation(invitation)) {
				return inviteByWallet(
					invitation.walletAddress!,
					invitation.role as "member" | "admin",
					invitation.organizationId
				);
			}
			return inviteByEmail(
				invitation.email,
				invitation.role as "member" | "admin",
				invitation.organizationId
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orgInvitationsOptions(activeOrg?.id).queryKey,
			});
			setResendingId(null);
		},
		onError: () => {
			setResendingId(null);
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

	const handleInvite = () => {
		const value = inviteType === "email" ? inviteEmail : inviteWallet;
		if (!value.trim()) return;
		inviteMutation.mutate({
			type: inviteType,
			value: value.trim(),
			role: inviteRole,
		});
	};

	const handleCancelInvitation = () => {
		if (cancelInvitation) {
			cancelMutation.mutate(cancelInvitation.id);
		}
	};

	const isExpired = (date: Date) => {
		return new Date(date) < new Date();
	};

	const pendingInvitations = invitations?.filter((inv) => inv.status === "pending") ?? [];

	return (
		<div className="space-y-6">
			<PageHeader
				title="Invitations"
				description={`Manage invitations for ${activeOrg.name}`}
				action={
					isOwnerOrAdmin ? (
						<Button onClick={() => setInviteDialogOpen(true)}>
							<Plus className="mr-2 h-4 w-4" />
							Invite Member
						</Button>
					) : undefined
				}
			/>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Mail className="h-5 w-5" />
						Pending Invitations
					</CardTitle>
					<CardDescription>
						{pendingInvitations.length} pending{" "}
						{pendingInvitations.length === 1 ? "invitation" : "invitations"}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isPendingInvitations ? (
						<div className="space-y-4">
							{[...Array(3)].map((_, i) => (
								<Skeleton key={i} className="h-16 w-full" />
							))}
						</div>
					) : invitations?.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							No invitations found. Click "Invite Member" to add new members.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead>Invitee</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Expires</TableHead>
									{isOwnerOrAdmin && (
										<TableHead className="text-right">
											Actions
										</TableHead>
									)}
								</TableRow>
							</TableHeader>
							<TableBody>
								{invitations?.map((invitation) => {
									const isWallet = isWalletInvitation(invitation);
									const isPending = invitation.status === "pending";
									const expired = isExpired(invitation.expiresAt);

									return (
										<TableRow key={invitation.id}>
											<TableCell>
												<div className="flex flex-col">
													<span className="font-medium">
														{isWallet
															? `${invitation.walletAddress?.slice(0, 6)}...${invitation.walletAddress?.slice(-4)}`
															: invitation.email}
													</span>
													{isWallet && (
														<span className="text-xs text-muted-foreground">
															{invitation.email}
														</span>
													)}
												</div>
											</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className={
														isWallet
															? "bg-purple-500/20 text-purple-400 border-purple-500/30"
															: "bg-blue-500/20 text-blue-400 border-blue-500/30"
													}
												>
													{isWallet ? (
														<>
															<Wallet className="mr-1 h-3 w-3" />
															Wallet
														</>
													) : (
														<>
															<Mail className="mr-1 h-3 w-3" />
															Email
														</>
													)}
												</Badge>
											</TableCell>
											<TableCell>
												<RoleBadge role={invitation.role} />
											</TableCell>
											<TableCell>
												<StatusBadge
													status={invitation.status}
													expired={expired && isPending}
												/>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{formatDate(invitation.expiresAt)}
											</TableCell>
											{isOwnerOrAdmin && (
												<TableCell className="text-right">
													{isPending && (
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
																<DropdownMenuItem
																	onClick={() => resendMutation.mutate(invitation)}
																	disabled={resendingId === invitation.id}
																>
																	{resendingId === invitation.id ? (
																		<Loader2 className="mr-2 h-4 w-4 animate-spin" />
																	) : (
																		<RefreshCw className="mr-2 h-4 w-4" />
																	)}
																	Resend Invitation
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() => setCancelInvitation(invitation)}
																	className="text-destructive focus:text-destructive"
																>
																	<XCircle className="mr-2 h-4 w-4" />
																	Cancel Invitation
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

			{/* Invite Member Dialog */}
			<Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Invite Member</DialogTitle>
						<DialogDescription>
							Invite someone to join {activeOrg.name}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<Tabs
							value={inviteType}
							onValueChange={(v) => setInviteType(v as "email" | "wallet")}
						>
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="email">
									<Mail className="mr-2 h-4 w-4" />
									Email
								</TabsTrigger>
								<TabsTrigger value="wallet">
									<Wallet className="mr-2 h-4 w-4" />
									Wallet
								</TabsTrigger>
							</TabsList>
						</Tabs>

						{inviteType === "email" ? (
							<div className="space-y-2">
								<Label htmlFor="email">
									Email Address
								</Label>
								<Input
									id="email"
									type="email"
									placeholder="colleague@example.com"
									value={inviteEmail}
									onChange={(e) => setInviteEmail(e.target.value)}
								/>
							</div>
						) : (
							<div className="space-y-2">
								<Label htmlFor="wallet">
									Wallet Address
								</Label>
								<Input
									id="wallet"
									type="text"
									placeholder="0x..."
									value={inviteWallet}
									onChange={(e) => setInviteWallet(e.target.value)}
									className="font-mono"
								/>
								<p className="text-xs text-muted-foreground">
									The user must sign in with SIWE using this wallet address to
									accept the invitation.
								</p>
							</div>
						)}

						<div className="space-y-2">
							<Label htmlFor="role">
								Role
							</Label>
							<RoleSelect
								value={inviteRole}
								onValueChange={setInviteRole}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setInviteDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleInvite}
							disabled={
								inviteMutation.isPending ||
								(inviteType === "email" ? !inviteEmail.trim() : !inviteWallet.trim())
							}
						>
							{inviteMutation.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Send Invitation
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Cancel Invitation Confirmation */}
			<AlertDialog
				open={!!cancelInvitation}
				onOpenChange={() => setCancelInvitation(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Cancel Invitation
						</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to cancel the invitation for{" "}
							<span className="font-medium text-foreground">
								{isWalletInvitation(cancelInvitation ?? {})
									? cancelInvitation?.walletAddress
									: cancelInvitation?.email}
							</span>
							? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							Keep Invitation
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleCancelInvitation}
							disabled={cancelMutation.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{cancelMutation.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Cancel Invitation
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
