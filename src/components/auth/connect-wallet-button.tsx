import { Loader2, Wallet } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useSiweAuth } from "@/hooks/use-siwe-auth";
import { useConnectWallet } from "@/hooks/use-connect-wallet";

interface ConnectWalletButtonProps {
	onSuccess?: () => void;
	onError?: (error: string) => void;
	mode?: "signin" | "link";
	className?: string;
}

/**
 * A button component that handles the full SIWE (Sign-In With Ethereum) flow:
 * 1. Connect wallet via wagmi
 * 2. Get SIWE challenge (nonce + message) from server
 * 3. Sign SIWE message
 * 4. Verify signature and create session
 */
export function ConnectWalletButton({
	onSuccess,
	onError,
	mode = "signin",
	className,
}: ConnectWalletButtonProps) {
	const { address, isConnected, isConnecting, connectors, connect } =
		useConnectWallet();
	const { authenticate, isAuthenticating, error, clearError } = useSiweAuth({
		mode,
		onSuccess,
		onError,
	});

	// Clear error when wallet state changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally depends on wallet state
	useEffect(() => {
		clearError();
	}, [isConnected, address]);

	// Auto-trigger SIWE auth when wallet connects (signin mode only)
	useEffect(() => {
		if (isConnected && address && !isAuthenticating && mode === "signin") {
			authenticate();
		}
	}, [isConnected, address, isAuthenticating, mode, authenticate]);

	const isLoading = isConnecting || isAuthenticating;

	// If connected and in link mode, show authenticate button
	if (isConnected && address && mode === "link") {
		return (
			<div className="space-y-2">
				<Button
					onClick={authenticate}
					disabled={isLoading}
					className={className}
				>
					{isAuthenticating ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Signing message...
						</>
					) : (
						<>
							<Wallet className="mr-2 h-4 w-4" />
							Link {address.slice(0, 6)}...{address.slice(-4)}
						</>
					)}
				</Button>
				{error && <p className="text-sm text-red-400">{error}</p>}
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{connectors.map((connector) => (
				<Button
					key={connector.uid}
					type="button"
					onClick={() => {
						clearError();
						connect(connector);
					}}
					disabled={isLoading}
					variant="outline"
					className={
						className ||
						"w-full border-zinc-700 bg-zinc-800/50 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-50 hover:border-orange-500/50"
					}
				>
					{isLoading ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							{isConnecting ? "Connecting..." : "Signing..."}
						</>
					) : (
						<>
							<Wallet className="mr-2 h-4 w-4" />
							{connector.name}
						</>
					)}
				</Button>
			))}
			{error && <p className="text-sm text-red-400 text-center">{error}</p>}
		</div>
	);
}
