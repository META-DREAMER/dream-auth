import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { siwe } from "@/lib/auth-client";
import { createSiweChallengeFn } from "@/lib/siwe.server";

interface UseSiweAuthOptions {
	mode: "signin" | "link";
	onSuccess?: () => void;
	onError?: (error: string) => void;
	/** Whether to disconnect wallet on error (default: true for signin, false for link) */
	disconnectOnError?: boolean;
}

/**
 * Hook that handles SIWE (Sign-In With Ethereum) authentication flow:
 * 1. Get SIWE challenge (nonce + message) from server
 * 2. Sign message with wallet
 * 3. Verify signature and authenticate
 */
export function useSiweAuth({
	mode,
	onSuccess,
	onError,
	disconnectOnError,
}: UseSiweAuthOptions) {
	const { address, chain } = useAccount();
	const { disconnect } = useDisconnect();
	const { mutateAsync: signMessageAsync } = useSignMessage();
	const createSiweChallenge = useServerFn(createSiweChallengeFn);

	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const shouldDisconnectOnError = disconnectOnError ?? mode === "signin";

	const authenticate = useCallback(async () => {
		if (!address || !chain) {
			setError("Wallet not connected");
			return false;
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

			onSuccess?.();
			return true;
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Authentication failed";
			setError(errorMessage);
			onError?.(errorMessage);

			if (shouldDisconnectOnError) {
				disconnect();
			}
			return false;
		} finally {
			setIsAuthenticating(false);
		}
	}, [
		address,
		chain,
		mode,
		signMessageAsync,
		createSiweChallenge,
		disconnect,
		shouldDisconnectOnError,
		onSuccess,
		onError,
	]);

	const clearError = useCallback(() => setError(null), []);

	return {
		authenticate,
		isAuthenticating,
		error,
		clearError,
	};
}
