import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { ErrorAlert } from "@/components/shared/error-alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useSiweAuth } from "@/hooks/use-siwe-auth";
import { useWalletConnect } from "@/hooks/use-wallet-connect";

/**
 * Dialog component for linking a new wallet to an existing account.
 * Uses SIWE to verify wallet ownership before linking.
 */
export function LinkWalletDialog() {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();

	const { address, isConnected, isConnecting, connect, disconnect } =
		useWalletConnect();

	const { authenticate, isAuthenticating, error, clearError } = useSiweAuth({
		mode: "link",
		disconnectOnError: false,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["linked-accounts"] });
			disconnect();
			setOpen(false);
		},
	});

	const handleConnect = () => {
		clearError();
		connect();
	};

	const handleOpenChange = (newOpen: boolean) => {
		setOpen(newOpen);
		if (!newOpen) {
			clearError();
			if (isConnected) {
				disconnect();
			}
		}
	};

	const isLoading = isConnecting || isAuthenticating;

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
					{error && <ErrorAlert message={error} />}

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
								onClick={authenticate}
								disabled={isLoading}
								className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium"
							>
								{isAuthenticating ? (
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
