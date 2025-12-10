import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Wallet } from "lucide-react";
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
import { authClient } from "@/lib/auth-client";


/**
 * Displays the user's linked wallet addresses with the ability to unlink them.
 */
export function WalletList() {
	const queryClient = useQueryClient();
	const [deletingId, setDeletingId] = useState<string | null>(null);

	// Fetch linked accounts
	const {
		data: accounts,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["linked-accounts"],
		queryFn: async () => {
			const result = await authClient.listAccounts();
			if (result.error) {
				throw new Error(result.error.message);
			}
			return result.data ?? [];
		},
	});

	// Unlink account mutation
	const unlinkMutation = useMutation({
		mutationFn: async (accountId: string) => {
			const result = await authClient.unlinkAccount({
				providerId: "siwe",
				accountId,
			});
			if (result.error) {
				throw new Error(result.error.message);
			}
			return result;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["linked-accounts"] });
		},
	});

	const handleUnlink = async (accountId: string) => {
		setDeletingId(accountId);
		try {
			await unlinkMutation.mutateAsync(accountId);
		} finally {
			setDeletingId(null);
		}
	};

	// Filter for SIWE/wallet accounts only
	const walletAccounts = accounts?.filter(
		(account) => account.providerId === "siwe",
	);

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
			<p className="text-sm text-red-400">
				Failed to load wallets: {error.message}
			</p>
		);
	}

	if (!walletAccounts || walletAccounts.length === 0) {
		return (
			<div className="text-center py-6 text-zinc-500">
				<Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
				<p>No wallets linked yet</p>
				<p className="text-xs mt-1">
					Link a wallet to sign in with your Ethereum address
				</p>
			</div>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow className="border-zinc-800 hover:bg-transparent">
					<TableHead className="text-zinc-400">Address</TableHead>
					<TableHead className="text-zinc-400">Linked</TableHead>
					<TableHead className="text-zinc-400 w-[100px]">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{walletAccounts.map((account) => (
					<TableRow
						key={account.id}
						className="border-zinc-800 hover:bg-zinc-800/50"
					>
						<TableCell className="font-mono text-zinc-300 text-sm">
							<span className="flex items-center gap-2">
								<Wallet className="h-4 w-4 text-orange-500" />
								{account.accountId.slice(0, 6)}...{account.accountId.slice(-4)}
							</span>
						</TableCell>
						<TableCell className="text-zinc-400 text-sm">
							{new Date(account.createdAt).toLocaleDateString()}
						</TableCell>
						<TableCell>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
										disabled={deletingId === account.accountId}
									>
										{deletingId === account.accountId ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Trash2 className="h-4 w-4" />
										)}
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent className="bg-zinc-900 border-zinc-800">
									<AlertDialogHeader>
										<AlertDialogTitle className="text-zinc-100">
											Unlink wallet?
										</AlertDialogTitle>
										<AlertDialogDescription className="text-zinc-400">
											This will remove the wallet{" "}
											<span className="font-mono text-zinc-300">
												{account.accountId.slice(0, 6)}...
												{account.accountId.slice(-4)}
											</span>{" "}
											from your account. You can link it again later.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">
											Cancel
										</AlertDialogCancel>
										<AlertDialogAction
											onClick={() => handleUnlink(account.accountId)}
											className="bg-red-500 text-white hover:bg-red-600"
										>
											Unlink
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

