import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, Loader2, Plus } from "lucide-react";
import { useState } from "react";
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
				<Button className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white">
					<Plus className="mr-2 h-4 w-4" />
					Add Passkey
				</Button>
			</DialogTrigger>
			<DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
				<DialogHeader>
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500">
						<Fingerprint className="h-6 w-6 text-white" />
					</div>
					<DialogTitle className="text-center text-zinc-100">
						Register a Passkey
					</DialogTitle>
					<DialogDescription className="text-center text-zinc-400">
						Passkeys let you sign in securely without a password using your
						device's biometrics or security key.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						{error && (
							<div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
								{error}
							</div>
						)}

						<div className="space-y-2">
							<Label htmlFor="passkey-name" className="text-zinc-300">
								Passkey Name (optional)
							</Label>
							<Input
								id="passkey-name"
								placeholder="e.g., MacBook Touch ID"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500"
							/>
							<p className="text-xs text-zinc-500">
								Give your passkey a name to identify it later
							</p>
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
							disabled={addMutation.isPending}
							className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
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

