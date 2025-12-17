import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Wallet, Loader2, UserPlus } from "lucide-react";
import { ErrorAlert } from "@/components/shared/error-alert";
import { RoleSelect } from "@/components/org/role-select";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
			<DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
				<DialogHeader>
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500">
						<UserPlus className="h-6 w-6 text-white" />
					</div>
					<DialogTitle className="text-center text-zinc-100">
						Invite Member
					</DialogTitle>
					<DialogDescription className="text-center text-zinc-400">
						Invite someone to join {orgName}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						{error && <ErrorAlert message={error} />}

						<Tabs
							value={inviteType}
							onValueChange={(v) => setInviteType(v as "email" | "wallet")}
						>
							<TabsList className="grid w-full grid-cols-2 bg-zinc-800">
								<TabsTrigger
									value="email"
									className="data-[state=active]:bg-zinc-700"
								>
									<Mail className="mr-2 h-4 w-4" />
									Email
								</TabsTrigger>
								<TabsTrigger
									value="wallet"
									className="data-[state=active]:bg-zinc-700"
								>
									<Wallet className="mr-2 h-4 w-4" />
									Wallet
								</TabsTrigger>
							</TabsList>
						</Tabs>

						{inviteType === "email" ? (
							<div className="space-y-2">
								<Label htmlFor="invite-email" className="text-zinc-300">
									Email Address
								</Label>
								<Input
									id="invite-email"
									type="email"
									placeholder="colleague@example.com"
									value={inviteEmail}
									onChange={(e) => setInviteEmail(e.target.value)}
									className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500"
								/>
							</div>
						) : (
							<div className="space-y-2">
								<Label htmlFor="invite-wallet" className="text-zinc-300">
									Wallet Address
								</Label>
								<Input
									id="invite-wallet"
									type="text"
									placeholder="0x..."
									value={inviteWallet}
									onChange={(e) => setInviteWallet(e.target.value)}
									className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500 font-mono"
								/>
								<p className="text-xs text-zinc-500">
									The user must sign in with SIWE using this wallet address to
									accept the invitation.
								</p>
							</div>
						)}

						<div className="space-y-2">
							<Label htmlFor="invite-role" className="text-zinc-300">
								Role
							</Label>
							<RoleSelect value={inviteRole} onValueChange={setInviteRole} />
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
							className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={
								inviteMutation.isPending ||
								(inviteType === "email"
									? !inviteEmail.trim()
									: !inviteWallet.trim())
							}
							className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
						>
							{inviteMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

