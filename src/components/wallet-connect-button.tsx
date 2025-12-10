import { useCallback, useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { Button } from "@/components/ui/button";
import { siwe } from "@/lib/auth-client";
import { createSiweChallengeFn } from "@/lib/siwe.server";

interface WalletConnectButtonProps {
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
export function WalletConnectButton({
	onSuccess,
	onError,
	mode = "signin",
	className,
}: WalletConnectButtonProps) {
	const { address, isConnected, chain } = useAccount();
	const { connectors, connect, isPending: isConnecting } = useConnect();
	const { disconnect } = useDisconnect();
	const { mutateAsync: signMessageAsync } = useSignMessage();

	// Wrap server function for use in component
	const createSiweChallenge = useServerFn(createSiweChallengeFn);

	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Clear error when wallet state changes
	useEffect(() => {
		setError(null);
	}, [isConnected, address]);

	const handleSiweAuth = useCallback(async () => {
		if (!address || !chain) {
			setError("Wallet not connected");
			return;
		}

		setIsAuthenticating(true);
		setError(null);

		try {
			// Step 1: Get SIWE challenge (nonce + prepared message) from server
			const { message } = await createSiweChallenge({
				data: { address, chainId: chain.id, mode },
			});

			// Step 2: Sign message with wallet
			const signature = await signMessageAsync({ message });

			// Step 3: Verify signature and authenticate
			const verifyResult = await siwe.verify({
				message,
				signature,
				walletAddress: address,
				chainId: chain.id,
			});

			if (verifyResult.error) {
				throw new Error(verifyResult.error.message || "Verification failed");
			}

			// Success!
			onSuccess?.();
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Authentication failed";
			setError(errorMessage);
			onError?.(errorMessage);

			// Disconnect wallet on error to allow retry
			disconnect();
		} finally {
			setIsAuthenticating(false);
		}
	}, [address, chain, mode, signMessageAsync, disconnect, onSuccess, onError]);

	// Auto-trigger SIWE auth when wallet connects
	useEffect(() => {
		if (isConnected && address && !isAuthenticating && mode === "signin") {
			handleSiweAuth();
		}
	}, [isConnected, address, isAuthenticating, mode, handleSiweAuth]);

	const handleConnect = useCallback(() => {
		// Use the first available connector (usually injected/MetaMask)
		const connector = connectors[0];
		if (connector) {
			connect({ connector });
		}
	}, [connectors, connect]);

	const isLoading = isConnecting || isAuthenticating;

	// If connected and in link mode, show authenticate button
	if (isConnected && address && mode === "link") {
		return (
			<div className="space-y-2">
				<Button
					onClick={handleSiweAuth}
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
			<Button
				type="button"
				onClick={handleConnect}
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
						{mode === "link" ? "Connect Wallet to Link" : "Connect Wallet"}
					</>
				)}
			</Button>
			{error && <p className="text-sm text-red-400 text-center">{error}</p>}
		</div>
	);
}

