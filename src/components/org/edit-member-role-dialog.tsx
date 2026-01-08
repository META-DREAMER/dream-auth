import { ShieldIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RoleSelect } from "@/components/org/role-select";
import { DialogHeaderScaffold } from "@/components/shared/dialog-scaffold";
import { ErrorAlert } from "@/components/shared/error-alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
} from "@/components/ui/dialog";
import { organization } from "@/lib/auth-client";
import { orgMembersOptions } from "@/lib/org-queries";

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

interface EditMemberRoleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	member: Member | null;
	orgId: string;
}

export function EditMemberRoleDialog({
	open,
	onOpenChange,
	member,
	orgId,
}: EditMemberRoleDialogProps) {
	const queryClient = useQueryClient();
	const [role, setRole] = useState<"member" | "admin">("member");
	const [error, setError] = useState<string | null>(null);

	// Initialize role when member changes
	useEffect(() => {
		if (member) {
			setRole((member.role as "member" | "admin") || "member");
		}
	}, [member]);

	const updateRoleMutation = useMutation({
		mutationFn: async () => {
			if (!member) throw new Error("No member selected");
			const result = await organization.updateMemberRole({
				memberId: member.id,
				role: role as "member" | "admin" | "owner",
			});
			if (result.error) {
				throw new Error(result.error.message || "Failed to update role");
			}
			return result;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orgMembersOptions(orgId).queryKey,
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
		updateRoleMutation.mutate();
	};

	const handleOpenChange = (isOpen: boolean) => {
		onOpenChange(isOpen);
		if (!isOpen) {
			setError(null);
		}
	};

	if (!member) return null;

	const hasChanged = role !== member.role;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeaderScaffold
					icon={ShieldIcon}
					title="Change Member Role"
					description={
						<>
							Update the role for{" "}
							<span className="font-medium">
								{member.user.name || member.user.email}
							</span>
						</>
					}
				/>

				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						{error && <ErrorAlert message={error} />}

						<div className="space-y-2">
							<RoleSelect
								value={role}
								onValueChange={setRole}
								showDescriptions
							/>
						</div>
					</div>

					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							type="submit"
							disabled={updateRoleMutation.isPending || !hasChanged}
						>
							{updateRoleMutation.isPending ? (
								<>
									<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
									Saving...
								</>
							) : (
								"Save Changes"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
