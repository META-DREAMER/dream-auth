import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { ErrorAlert } from "@/components/shared/error-alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passkey } from "@/lib/auth-client";

export function AddPasskeyDialog() {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);

	const addMutation = useMutation({
		mutationFn: async (passkeyName: string) => {
			const result = await passkey.addPasskey({
				name: passkeyName || undefined,
			});
			if (result.error) {
				throw new Error(result.error.message || "Failed to register passkey");
			}
			return result;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["passkeys"] });
			setOpen(false);
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
		addMutation.mutate(name);
	};

	const handleOpenChange = (isOpen: boolean) => {
		setOpen(isOpen);
		if (!isOpen) {
			setName("");
			setError(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					Add Passkey
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
						<Fingerprint className="h-6 w-6 text-primary-foreground" />
					</div>
					<DialogTitle className="text-center">
						Register a Passkey
					</DialogTitle>
					<DialogDescription className="text-center">
						Passkeys let you sign in securely without a password using your
						device's biometrics or security key.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						{error && <ErrorAlert message={error} />}

						<div className="space-y-2">
							<Label htmlFor="passkey-name">
								Passkey Name (optional)
							</Label>
							<Input
								id="passkey-name"
								placeholder="e.g., MacBook Touch ID"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
							<p className="text-xs text-muted-foreground">
								Give your passkey a name to identify it later
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={addMutation.isPending}
						>
							{addMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Registering...
								</>
							) : (
								"Register Passkey"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
