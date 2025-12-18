import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useState } from "react";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import {
	EmptyState,
	ListError,
	ListSkeleton,
} from "@/components/shared/list-states";
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
		return <ListSkeleton />;
	}

	if (error) {
		return <ListError message={`Failed to load wallets: ${error.message}`} />;
	}

	if (!walletAccounts || walletAccounts.length === 0) {
		return (
			<EmptyState
				icon={Wallet}
				title="No wallets linked yet"
				description="Link a wallet to sign in with your Ethereum address"
			/>
		);
	}

	return (
		<div className="rounded-lg border overflow-hidden">
			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead>Address</TableHead>
						<TableHead>Linked</TableHead>
						<TableHead className="w-[100px] text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{walletAccounts.map((account) => (
						<TableRow
							key={account.id}
						>
							<TableCell className="font-mono text-sm">
								<span className="flex items-center gap-2">
									<Wallet className="h-4 w-4 text-orange-500 shrink-0" />
									<span className="truncate">
										{account.accountId.slice(0, 6)}...{account.accountId.slice(-4)}
									</span>
								</span>
							</TableCell>
							<TableCell className="text-muted-foreground text-sm">
								{new Date(account.createdAt).toLocaleDateString()}
							</TableCell>
							<TableCell className="text-right">
								<DeleteConfirmDialog
									title="Unlink Wallet"
									description={
										<>
											This will remove the wallet{" "}
											<span className="font-mono">
												{account.accountId.slice(0, 6)}...
												{account.accountId.slice(-4)}
											</span>{" "}
											from your account. You can link it again later.
										</>
									}
									onConfirm={() => handleUnlink(account.accountId)}
									isDeleting={deletingId === account.accountId}
									confirmText="Unlink"
									buttonSize="icon"
								/>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
