import { useCallback, useState } from "react";
import { createSiweMessage } from "viem/siwe";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { clientEnv } from "@/env.client";
import { siwe } from "@/lib/auth-client";

interface UseSiweAuthOptions {
	onSuccess?: () => void;
	onError?: (error: string) => void;
	/** Whether to disconnect wallet on error (default: true) */
	disconnectOnError?: boolean;
}

/**
 * Hook that handles SIWE (Sign-In With Ethereum) authentication flow:
 * 1. Get SIWE challenge (nonce) from server (via client call)
 * 2. Create SIWE message client-side
 * 3. Sign message with wallet
 * 4. Verify signature and authenticate
 */
export function useSiweAuth({
	onSuccess,
	onError,
	disconnectOnError = true,
}: UseSiweAuthOptions = {}) {
	const { address, chain } = useAccount();
	const { disconnect } = useDisconnect();
	const { mutateAsync: signMessageAsync } = useSignMessage();

	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const authenticate = useCallback(async () => {
		if (!address || !chain) {
			setError("Wallet not connected");
			return false;
		}

		setIsAuthenticating(true);
		setError(null);

		try {
			// Step 1: Get SIWE nonce
			const nonceResponse = await siwe.nonce({
				walletAddress: address,
				chainId: chain.id,
			});

			if (nonceResponse.error || !nonceResponse.data?.nonce) {
				throw new Error(
					nonceResponse.error?.message || "Failed to generate SIWE nonce",
				);
			}

			const nonce = nonceResponse.data.nonce;
			const statement = "Sign in with your Ethereum wallet to Dream Auth";

			// Determine domain and URI
			// Use configured auth URL or fallback to current origin
			const authUrlStr = clientEnv.VITE_AUTH_URL || window.location.origin;
			const authUrl = new URL(authUrlStr);

			// Step 2: Create SIWE message using viem's utility (bypasses buggy SiweMessage constructor in siwe v3)
			const message = createSiweMessage({
				domain: authUrl.hostname,
				address,
				statement,
				uri: authUrlStr,
				version: "1",
				chainId: chain.id,
				nonce,
			});

			// Step 3: Sign message with wallet
			const signature = await signMessageAsync({ message });

			// Step 4: Verify signature and authenticate
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

			if (disconnectOnError) {
				disconnect();
			}
			return false;
		} finally {
			setIsAuthenticating(false);
		}
	}, [
		address,
		chain,
		signMessageAsync,
		disconnect,
		disconnectOnError,
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
