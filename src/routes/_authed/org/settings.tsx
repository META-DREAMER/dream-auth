import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GearIcon, SpinnerIcon, WarningIcon } from "@phosphor-icons/react";
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
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<GearIcon className="h-5 w-5" />
						Organization Details
					</CardTitle>
					<CardDescription>
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
								<Label htmlFor="name">
									Organization Name
								</Label>
								<Input
									id="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									disabled={!canEdit}
									placeholder="My Organization"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="slug">
									Organization Slug
								</Label>
								<Input
									id="slug"
									value={slug}
									onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
									disabled={!canEdit}
									className="font-mono"
									placeholder="my-organization"
								/>
								<p className="text-xs text-muted-foreground">
									URL-friendly identifier. Only lowercase letters, numbers, and
									hyphens allowed.
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="logo">
									Logo URL
								</Label>
								<Input
									id="logo"
									type="url"
									value={logo}
									onChange={(e) => setLogo(e.target.value)}
									disabled={!canEdit}
									placeholder="https://example.com/logo.png"
								/>
								{logo && (
									<div className="mt-2 flex items-center gap-3">
										<span className="text-xs text-muted-foreground">Preview:</span>
										<img
											src={logo}
											alt="Logo preview"
											className="h-10 w-10 rounded-lg object-cover bg-muted"
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
					<CardFooter className="border-t pt-4">
						<Button
							onClick={handleSave}
							disabled={!hasChanges || updateMutation.isPending}
						>
							{updateMutation.isPending && (
								<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
							)}
							Save Changes
						</Button>
					</CardFooter>
				)}
			</Card>

			{/* Danger Zone - Only visible to owners */}
			{isOwner && (
				<Card className="border-destructive/50">
					<CardHeader>
						<CardTitle className="text-destructive flex items-center gap-2">
							<WarningIcon className="h-5 w-5" />
							Danger Zone
						</CardTitle>
						<CardDescription>
							Irreversible and destructive actions
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="rounded-lg border border-destructive/50 p-4">
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
								<div>
									<h4 className="font-medium">
										Delete Organization
									</h4>
									<p className="text-sm text-muted-foreground mt-1">
										Permanently delete this organization and all of its data.
										This action cannot be undone.
									</p>
								</div>
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button variant="destructive" className="shrink-0">
											Delete Organization
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												Delete Organization
											</AlertDialogTitle>
											<AlertDialogDescription className="space-y-3">
												<p>
													This action cannot be undone. This will permanently
													delete the{" "}
													<span className="font-semibold text-foreground">
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
													<span className="font-mono bg-muted px-1.5 py-0.5 rounded text-destructive">
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
												placeholder={activeOrg.name}
											/>
										</div>
										<AlertDialogFooter>
											<AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
												Cancel
											</AlertDialogCancel>
											<AlertDialogAction
												onClick={() => deleteMutation.mutate()}
												disabled={!canDelete || deleteMutation.isPending}
												className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
											>
												{deleteMutation.isPending && (
													<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
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

