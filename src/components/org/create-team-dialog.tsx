import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UsersRound, Loader2 } from "lucide-react";
import { ErrorAlert } from "@/components/shared/error-alert";
import { DialogHeaderScaffold } from "@/components/shared/dialog-scaffold";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { organization } from "@/lib/auth-client";
import { orgTeamsOptions } from "@/lib/org-queries";

interface CreateTeamDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	orgId: string;
}

export function CreateTeamDialog({
	open,
	onOpenChange,
	orgId,
}: CreateTeamDialogProps) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);

	const createMutation = useMutation({
		mutationFn: async () => {
			const result = await organization.createTeam({
				name,
			});
			if (result.error) {
				throw new Error(result.error.message || "Failed to create team");
			}
			return result;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orgTeamsOptions(orgId).queryKey,
			});
			onOpenChange(false);
			setName("");
			setError(null);
		},
		onError: (err: Error) => {
			setError(err.message);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		createMutation.mutate();
	};

	const handleOpenChange = (isOpen: boolean) => {
		onOpenChange(isOpen);
		if (!isOpen) {
			setName("");
			setError(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeaderScaffold
					icon={UsersRound}
					title="Create Team"
					description="Create a new team to organize members and manage access."
				/>

				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						{error && <ErrorAlert message={error} />}

						<div className="space-y-2">
							<Label htmlFor="team-name">
								Team Name
							</Label>
							<Input
								id="team-name"
								placeholder="e.g., Engineering, Marketing"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
							/>
						</div>
					</div>

					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							type="submit"
							disabled={createMutation.isPending || !name}
						>
							{createMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Creating...
								</>
							) : (
								"Create Team"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

