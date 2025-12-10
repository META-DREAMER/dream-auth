import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

	// Fetch passkeys
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

	// Delete passkey mutation
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
		return (
			<div className="space-y-3">
				<Skeleton className="h-12 w-full bg-zinc-800" />
				<Skeleton className="h-12 w-full bg-zinc-800" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
				Failed to load passkeys. Please try again.
			</div>
		);
	}

	if (!passkeys || passkeys.length === 0) {
		return (
			<div className="rounded-lg bg-zinc-800/50 border border-zinc-700 p-8 text-center">
				<Fingerprint className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
				<p className="text-zinc-400 mb-2">No passkeys registered</p>
				<p className="text-sm text-zinc-500">
					Add a passkey to enable passwordless sign-in
				</p>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-zinc-700 overflow-hidden">
			<Table>
				<TableHeader>
					<TableRow className="border-zinc-700 hover:bg-transparent">
						<TableHead className="text-zinc-400">Name</TableHead>
						<TableHead className="text-zinc-400">Created</TableHead>
						<TableHead className="text-zinc-400 text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{passkeys.map((key) => (
						<TableRow key={key.id} className="border-zinc-700 hover:bg-zinc-800/50">
							<TableCell className="font-medium text-zinc-200">
								<div className="flex items-center gap-2">
									<Fingerprint className="h-4 w-4 text-emerald-500" />
									{key.name || "Unnamed Passkey"}
									{key.deviceType && (
										<Badge
											variant="outline"
											className="ml-2 border-zinc-600 text-zinc-400 text-xs"
										>
											{key.deviceType}
										</Badge>
									)}
								</div>
							</TableCell>
							<TableCell className="text-zinc-400">
								{formatDate(key.createdAt)}
							</TableCell>
							<TableCell className="text-right">
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											disabled={deletingId === key.id}
											className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
										>
											{deletingId === key.id ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Trash2 className="h-4 w-4" />
											)}
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent className="bg-zinc-900 border-zinc-800">
										<AlertDialogHeader>
											<AlertDialogTitle className="text-zinc-100">
												Delete Passkey
											</AlertDialogTitle>
											<AlertDialogDescription className="text-zinc-400">
												Are you sure you want to delete "{key.name || "this passkey"}"?
												This action cannot be undone and you will no longer be able to
												sign in with this passkey.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">
												Cancel
											</AlertDialogCancel>
											<AlertDialogAction
												onClick={() => handleDelete(key.id)}
												className="bg-red-500 text-white hover:bg-red-600"
											>
												Delete
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

