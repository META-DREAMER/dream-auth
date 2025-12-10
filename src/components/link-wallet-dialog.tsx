import { useState } from "react";
import { Loader2, Plus, Wallet } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { siwe } from "@/lib/auth-client";
import { createSiweChallengeFn } from "@/lib/siwe.server";

/**
 * Dialog component for linking a new wallet to an existing account.
 * Uses SIWE to verify wallet ownership before linking.
 */
export function LinkWalletDialog() {
	const [open, setOpen] = useState(false);
	const [isLinking, setIsLinking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const queryClient = useQueryClient();
	const { address, isConnected, chain } = useAccount();
	const { connectors, connect, isPending: isConnecting } = useConnect();
	const { disconnect } = useDisconnect();
	const { signMessageAsync } = useSignMessage();

	// Wrap server function for use in component
	const createSiweChallenge = useServerFn(createSiweChallengeFn);

	const handleConnect = () => {
		setError(null);
		const connector = connectors[0];
		if (connector) {
			connect({ connector });
		}
	};

	const handleLink = async () => {
		if (!address || !chain) {
			setError("Wallet not connected");
			return;
		}

		setIsLinking(true);
		setError(null);

		try {
			// Step 1: Get SIWE challenge (nonce + prepared message) from server
			const { message } = await createSiweChallenge({
				data: { address, chainId: chain.id, mode: "link" },
			});

			// Step 2: Sign message with wallet
			const signature = await signMessageAsync({ message });

			// Step 3: Verify and link the wallet to the account
			// With accountLinking enabled on the server, this will link the wallet
			// to the currently authenticated user's account
			const verifyResult = await siwe.verify({
				message,
				signature,
				walletAddress: address,
				chainId: chain.id,
			});

			if (verifyResult.error) {
				throw new Error(
					verifyResult.error.message || "Failed to link wallet",
				);
			}

			// Success - refresh the accounts list and close dialog
			queryClient.invalidateQueries({ queryKey: ["linked-accounts"] });
			disconnect();
			setOpen(false);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to link wallet";
			setError(errorMessage);
		} finally {
			setIsLinking(false);
		}
	};

	const handleOpenChange = (newOpen: boolean) => {
		setOpen(newOpen);
		if (!newOpen) {
			// Reset state when closing
			setError(null);
			if (isConnected) {
				disconnect();
			}
		}
	};

	const isLoading = isConnecting || isLinking;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
				>
					<Plus className="mr-2 h-4 w-4" />
					Link Wallet
				</Button>
			</DialogTrigger>
			<DialogContent className="bg-zinc-900 border-zinc-800">
				<DialogHeader>
					<DialogTitle className="text-zinc-100 flex items-center gap-2">
						<Wallet className="h-5 w-5 text-orange-500" />
						Link Ethereum Wallet
					</DialogTitle>
					<DialogDescription className="text-zinc-400">
						Connect and sign with your wallet to link it to your account.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{error && (
						<div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
							{error}
						</div>
					)}

					{!isConnected ? (
						<Button
							onClick={handleConnect}
							disabled={isLoading}
							variant="outline"
							className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-100 hover:bg-zinc-800 hover:border-orange-500/50"
						>
							{isConnecting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Connecting...
								</>
							) : (
								<>
									<Wallet className="mr-2 h-4 w-4" />
									Connect Wallet
								</>
							)}
						</Button>
					) : (
						<div className="space-y-4">
							<div className="rounded-lg bg-zinc-800/50 border border-zinc-700 p-4">
								<p className="text-sm text-zinc-400 mb-1">Connected wallet:</p>
								<p className="font-mono text-zinc-100">
									{address?.slice(0, 6)}...{address?.slice(-4)}
								</p>
							</div>

							<Button
								onClick={handleLink}
								disabled={isLoading}
								className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium"
							>
								{isLinking ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Signing & Linking...
									</>
								) : (
									"Sign Message to Link"
								)}
							</Button>

							<Button
								onClick={() => disconnect()}
								variant="ghost"
								className="w-full text-zinc-400 hover:text-zinc-100"
								disabled={isLoading}
							>
								Disconnect & Use Different Wallet
							</Button>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

