import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { useState } from "react";
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

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

interface CreateOrgDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateOrgDialog({
	open,
	onOpenChange,
}: CreateOrgDialogProps) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [logo, setLogo] = useState("");
	const [error, setError] = useState<string | null>(null);

	const createMutation = useMutation({
		mutationFn: async () => {
			const result = await organization.create({
				name,
				slug: slug || generateSlug(name),
				logo: logo || undefined,
			});
			if (result.error) {
				throw new Error(result.error.message || "Failed to create organization");
			}
			return result;
		},
		onSuccess: () => {
			// Invalidate organization list and active organization queries
			queryClient.invalidateQueries({
				queryKey: ["organizations"],
			});
			queryClient.invalidateQueries({
				queryKey: ["organization", "active"],
			});
			onOpenChange(false);
			setName("");
			setSlug("");
			setLogo("");
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
			setSlug("");
			setLogo("");
			setError(null);
		}
	};

	const handleNameChange = (value: string) => {
		setName(value);
		if (!slug || slug === generateSlug(name)) {
			setSlug(generateSlug(value));
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeaderScaffold
					icon={Building2}
					title="Create Organization"
					description="Create a new organization to collaborate with your team."
				/>

				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						{error && <ErrorAlert message={error} />}

						<div className="space-y-2">
							<Label htmlFor="org-name">
								Organization Name
							</Label>
							<Input
								id="org-name"
								placeholder="e.g., Acme Inc."
								value={name}
								onChange={(e) => handleNameChange(e.target.value)}
								required
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="org-slug">
								Slug
							</Label>
							<Input
								id="org-slug"
								placeholder="e.g., acme-inc"
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
								required
							/>
							<p className="text-xs text-muted-foreground">
								Used in URLs. Auto-generated from name if left empty.
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="org-logo">
								Logo URL (optional)
							</Label>
							<Input
								id="org-logo"
								type="url"
								placeholder="https://example.com/logo.png"
								value={logo}
								onChange={(e) => setLogo(e.target.value)}
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
								"Create Organization"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

