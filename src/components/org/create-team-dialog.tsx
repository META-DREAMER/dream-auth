import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UsersRound, Loader2 } from "lucide-react";
import { ErrorAlert } from "@/components/shared/error-alert";
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
			<DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
				<DialogHeader>
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500">
						<UsersRound className="h-6 w-6 text-white" />
					</div>
					<DialogTitle className="text-center text-zinc-100">
						Create Team
					</DialogTitle>
					<DialogDescription className="text-center text-zinc-400">
						Create a new team to organize members and manage access.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						{error && <ErrorAlert message={error} />}

						<div className="space-y-2">
							<Label htmlFor="team-name" className="text-zinc-300">
								Team Name
							</Label>
							<Input
								id="team-name"
								placeholder="e.g., Engineering, Marketing"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500"
							/>
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
							disabled={createMutation.isPending || !name}
							className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
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

