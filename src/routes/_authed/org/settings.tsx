import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Loader2, AlertTriangle } from "lucide-react";
import { authClient, organization } from "@/lib/auth-client";
import { orgFullOptions } from "@/lib/org-queries";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { SelectOrgPrompt } from "@/components/org/select-org-prompt";
import { PageHeader } from "@/components/org/page-header";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authed/org/settings")({
	component: OrgSettingsPage,
});

function OrgSettingsPage() {
	const { data: activeOrg, isPending: isPendingOrg } =
		authClient.useActiveOrganization();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { isOwner, isAdmin } = useOrgPermissions();

	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [logo, setLogo] = useState("");
	const [deleteConfirmText, setDeleteConfirmText] = useState("");

	const { data: fullOrg, isPending: isPendingFull } = useQuery(
		orgFullOptions(activeOrg?.id)
	);

	// Update local state when org data loads
	useEffect(() => {
		if (fullOrg) {
			setName(fullOrg.name ?? "");
			setSlug(fullOrg.slug ?? "");
			setLogo(fullOrg.logo ?? "");
		}
	}, [fullOrg]);

	const updateMutation = useMutation({
		mutationFn: async (data: { name?: string; slug?: string; logo?: string }) => {
			return organization.update({
				data,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["organization", activeOrg?.id],
			});
			// Also invalidate the organizations list to update the sidebar
			queryClient.invalidateQueries({
				queryKey: ["organizations"],
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async () => {
			if (!activeOrg) throw new Error("No active organization");
			return organization.delete({
				organizationId: activeOrg.id,
			});
		},
		onSuccess: () => {
			// Invalidate all org-related queries
			queryClient.invalidateQueries({ queryKey: ["organization"] });
			queryClient.invalidateQueries({ queryKey: ["organizations"] });
			// Navigate back to org index
			navigate({ to: "/org" });
		},
	});

	const canEdit = isOwner || isAdmin;

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

	const handleSave = () => {
		const updates: { name?: string; slug?: string; logo?: string } = {};

		if (name !== fullOrg?.name) updates.name = name;
		if (slug !== fullOrg?.slug) updates.slug = slug;
		if (logo !== (fullOrg?.logo ?? "")) updates.logo = logo || undefined;

		if (Object.keys(updates).length > 0) {
			updateMutation.mutate(updates);
		}
	};

	const hasChanges =
		name !== fullOrg?.name ||
		slug !== fullOrg?.slug ||
		logo !== (fullOrg?.logo ?? "");

	const canDelete = deleteConfirmText === activeOrg.name;

	return (
		<div className="space-y-6">
			<PageHeader
				title="Settings"
				description={`Manage settings for ${activeOrg.name}`}
			/>

			{/* Organization Details */}
			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader>
					<CardTitle className="text-zinc-100 flex items-center gap-2">
						<Settings className="h-5 w-5" />
						Organization Details
					</CardTitle>
					<CardDescription className="text-zinc-400">
						Update your organization's information
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isPendingFull ? (
						<div className="space-y-4">
							{[...Array(3)].map((_, i) => (
								<Skeleton key={i} className="h-10 w-full" />
							))}
						</div>
					) : (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name" className="text-zinc-300">
									Organization Name
								</Label>
								<Input
									id="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									disabled={!canEdit}
									className="bg-zinc-800 border-zinc-700 text-zinc-100 disabled:opacity-50"
									placeholder="My Organization"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="slug" className="text-zinc-300">
									Organization Slug
								</Label>
								<Input
									id="slug"
									value={slug}
									onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
									disabled={!canEdit}
									className="bg-zinc-800 border-zinc-700 text-zinc-100 disabled:opacity-50 font-mono"
									placeholder="my-organization"
								/>
								<p className="text-xs text-zinc-500">
									URL-friendly identifier. Only lowercase letters, numbers, and
									hyphens allowed.
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="logo" className="text-zinc-300">
									Logo URL
								</Label>
								<Input
									id="logo"
									type="url"
									value={logo}
									onChange={(e) => setLogo(e.target.value)}
									disabled={!canEdit}
									className="bg-zinc-800 border-zinc-700 text-zinc-100 disabled:opacity-50"
									placeholder="https://example.com/logo.png"
								/>
								{logo && (
									<div className="mt-2 flex items-center gap-3">
										<span className="text-xs text-zinc-500">Preview:</span>
										<img
											src={logo}
											alt="Logo preview"
											className="h-10 w-10 rounded-lg object-cover bg-zinc-800"
											onError={(e) => {
												e.currentTarget.style.display = "none";
											}}
										/>
									</div>
								)}
							</div>
						</div>
					)}
				</CardContent>
				{canEdit && (
					<CardFooter className="border-t border-zinc-800 pt-4">
						<Button
							onClick={handleSave}
							disabled={!hasChanges || updateMutation.isPending}
							className="bg-emerald-600 hover:bg-emerald-700"
						>
							{updateMutation.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Save Changes
						</Button>
					</CardFooter>
				)}
			</Card>

			{/* Danger Zone - Only visible to owners */}
			{isOwner && (
				<Card className="bg-zinc-900 border-red-900/50">
					<CardHeader>
						<CardTitle className="text-red-400 flex items-center gap-2">
							<AlertTriangle className="h-5 w-5" />
							Danger Zone
						</CardTitle>
						<CardDescription className="text-zinc-400">
							Irreversible and destructive actions
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="rounded-lg border border-red-900/50 p-4">
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
								<div>
									<h4 className="font-medium text-zinc-100">
										Delete Organization
									</h4>
									<p className="text-sm text-zinc-400 mt-1">
										Permanently delete this organization and all of its data.
										This action cannot be undone.
									</p>
								</div>
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											variant="destructive"
											className="bg-red-500 hover:bg-red-600 shrink-0"
										>
											Delete Organization
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent className="bg-zinc-900 border-zinc-800">
										<AlertDialogHeader>
											<AlertDialogTitle className="text-zinc-100">
												Delete Organization
											</AlertDialogTitle>
											<AlertDialogDescription className="text-zinc-400 space-y-3">
												<p>
													This action cannot be undone. This will permanently
													delete the{" "}
													<span className="font-semibold text-zinc-300">
														{activeOrg.name}
													</span>{" "}
													organization and remove all associated data including:
												</p>
												<ul className="list-disc pl-4 space-y-1">
													<li>All organization members</li>
													<li>All pending invitations</li>
													<li>All teams</li>
													<li>All organization settings</li>
												</ul>
												<p className="pt-2">
													Please type{" "}
													<span className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-red-400">
														{activeOrg.name}
													</span>{" "}
													to confirm.
												</p>
											</AlertDialogDescription>
										</AlertDialogHeader>
										<div className="py-2">
											<Input
												value={deleteConfirmText}
												onChange={(e) => setDeleteConfirmText(e.target.value)}
												className="bg-zinc-800 border-zinc-700 text-zinc-100"
												placeholder={activeOrg.name}
											/>
										</div>
										<AlertDialogFooter>
											<AlertDialogCancel
												onClick={() => setDeleteConfirmText("")}
												className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
											>
												Cancel
											</AlertDialogCancel>
											<AlertDialogAction
												onClick={() => deleteMutation.mutate()}
												disabled={!canDelete || deleteMutation.isPending}
												className="bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
											>
												{deleteMutation.isPending && (
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												)}
												Delete Organization
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

