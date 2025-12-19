import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EnvelopeIcon, WalletIcon, SpinnerIcon, UserPlusIcon } from "@phosphor-icons/react";
import { ErrorAlert } from "@/components/shared/error-alert";
import { DialogHeaderScaffold } from "@/components/shared/dialog-scaffold";
import { RoleSelect } from "@/components/org/role-select";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inviteByEmail, inviteByWallet } from "@/lib/invite-helpers";
import { orgInvitationsOptions } from "@/lib/org-queries";

interface InviteMemberDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	orgId: string;
	orgName: string;
}

export function InviteMemberDialog({
	open,
	onOpenChange,
	orgId,
	orgName,
}: InviteMemberDialogProps) {
	const queryClient = useQueryClient();
	const [inviteType, setInviteType] = useState<"email" | "wallet">("email");
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteWallet, setInviteWallet] = useState("");
	const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
	const [error, setError] = useState<string | null>(null);

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
			if (type === "email") {
				return inviteByEmail(value, role, orgId);
			}
			return inviteByWallet(value, role, orgId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orgInvitationsOptions(orgId).queryKey,
			});
			handleOpenChange(false);
		},
		onError: (err: Error) => {
			setError(err.message);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		const value = inviteType === "email" ? inviteEmail : inviteWallet;
		if (!value.trim()) return;
		inviteMutation.mutate({
			type: inviteType,
			value: value.trim(),
			role: inviteRole,
		});
	};

	const handleOpenChange = (isOpen: boolean) => {
		onOpenChange(isOpen);
		if (!isOpen) {
			setInviteEmail("");
			setInviteWallet("");
			setInviteRole("member");
			setInviteType("email");
			setError(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeaderScaffold
					icon={UserPlusIcon}
					title="Invite Member"
					description={`Invite someone to join ${orgName}`}
				/>

				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						{error && <ErrorAlert message={error} />}

						<Tabs
							value={inviteType}
							onValueChange={(v) => setInviteType(v as "email" | "wallet")}
						>
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="email">
									<EnvelopeIcon className="mr-2 h-4 w-4" />
									Email
								</TabsTrigger>
								<TabsTrigger value="wallet">
									<WalletIcon className="mr-2 h-4 w-4" />
									Wallet
								</TabsTrigger>
							</TabsList>
							<TabsContent value="email" className="space-y-2 mt-4">
								<Label htmlFor="invite-email">
									Email Address
								</Label>
								<Input
									id="invite-email"
									type="email"
									placeholder="colleague@example.com"
									value={inviteEmail}
									onChange={(e) => setInviteEmail(e.target.value)}
								/>
							</TabsContent>
							<TabsContent value="wallet" className="space-y-2 mt-4">
								<Label htmlFor="invite-wallet">
									Wallet Address
								</Label>
								<Input
									id="invite-wallet"
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
							</TabsContent>
						</Tabs>

						<div className="space-y-2">
							<Label htmlFor="invite-role">
								Role
							</Label>
							<RoleSelect value={inviteRole} onValueChange={setInviteRole} />
						</div>
					</div>

					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							type="submit"
							disabled={
								inviteMutation.isPending ||
								(inviteType === "email"
									? !inviteEmail.trim()
									: !inviteWallet.trim())
							}
						>
							{inviteMutation.isPending ? (
								<>
									<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
									Sending...
								</>
							) : (
								"Send Invitation"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

