import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint } from "lucide-react";
import { useState } from "react";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import {
	EmptyState,
	ListError,
	ListSkeleton,
} from "@/components/shared/list-states";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { passkey } from "@/lib/auth-client";

export function PasskeyList() {
	const queryClient = useQueryClient();
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const {
		data: passkeys,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["passkeys"],
		queryFn: async () => {
			const result = await passkey.listUserPasskeys();
			if (result.error) {
				throw new Error(result.error.message || "Failed to load passkeys");
			}
			return result.data ?? [];
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			const result = await passkey.deletePasskey({ id });
			if (result.error) {
				throw new Error(result.error.message || "Failed to delete passkey");
			}
			return result;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["passkeys"] });
			setDeletingId(null);
		},
		onError: () => {
			setDeletingId(null);
		},
	});

	const handleDelete = (id: string) => {
		setDeletingId(id);
		deleteMutation.mutate(id);
	};

	const formatDate = (date: string | Date) => {
		const d = typeof date === "string" ? new Date(date) : date;
		return d.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	if (isLoading) {
		return <ListSkeleton />;
	}

	if (error) {
		return <ListError message="Failed to load passkeys. Please try again." />;
	}

	if (!passkeys || passkeys.length === 0) {
		return (
			<EmptyState
				icon={Fingerprint}
				title="No passkeys registered"
				description="Add a passkey to enable passwordless sign-in"
				variant="card"
			/>
		);
	}

	return (
		<div className="rounded-lg border overflow-hidden">
			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead>Name</TableHead>
						<TableHead>Created</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{passkeys.map((key) => (
						<TableRow
							key={key.id}
						>
							<TableCell className="font-medium">
								<div className="flex items-center gap-2">
									<Fingerprint className="h-4 w-4 text-success" />
									{key.name || "Unnamed Passkey"}
									{key.deviceType && (
										<Badge
											variant="outline"
											className="ml-2 text-xs"
										>
											{key.deviceType}
										</Badge>
									)}
								</div>
							</TableCell>
							<TableCell className="text-muted-foreground">
								{formatDate(key.createdAt)}
							</TableCell>
							<TableCell className="text-right">
								<DeleteConfirmDialog
									title="Delete Passkey"
									description={
										<>
											Are you sure you want to delete "
											{key.name || "this passkey"}"? This action cannot be
											undone and you will no longer be able to sign in with this
											passkey.
										</>
									}
									onConfirm={() => handleDelete(key.id)}
									isDeleting={deletingId === key.id}
								/>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
