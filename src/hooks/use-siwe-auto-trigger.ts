import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useSiweAuth } from "./use-siwe-auth";

interface UseSiweAutoTriggerOptions {
	/** Whether the wallet is connected */
	isConnected: boolean;
	/** Whether the connect modal is open */
	isModalOpen: boolean;
	/** Callback when auto-trigger succeeds */
	onSuccess?: () => void;
	/** Callback when auto-trigger fails */
	onError?: (error: string) => void;
	/** Whether to auto-trigger (default: true) */
	enabled?: boolean;
}

/**
 * Shared hook for auto-triggering SIWE authentication when wallet connects.
 * 
 * Features:
 * - Auto-triggers once per address
 * - Prevents loops by tracking triggered addresses
 * - Respects modal state and authentication state
 * - Resets tracking when disconnected
 * 
 * Used by ConnectSIWEButton and LinkWalletDialog for consistent behavior.
 */
export function useSiweAutoTrigger({
	isConnected,
	isModalOpen,
	onSuccess,
	onError,
	enabled = true,
}: UseSiweAutoTriggerOptions) {
	const { address } = useAccount();
	const { authenticate, isAuthenticating } = useSiweAuth({
		onSuccess,
		onError,
	});

	// Track which address we've auto-triggered for to prevent loops
	const autoTriggeredForRef = useRef<string | null>(null);

	// Auto-trigger SIWE when wallet connects (once per address)
	useEffect(() => {
		if (
			enabled &&
			isConnected &&
			address &&
			!isModalOpen &&
			!isAuthenticating &&
			autoTriggeredForRef.current !== address
		) {
			// Mark this address as auto-triggered
			autoTriggeredForRef.current = address;
			// Small delay to let modal close animation complete
			const timer = setTimeout(() => {
				authenticate();
			}, 300);
			return () => clearTimeout(timer);
		}
	}, [enabled, isConnected, address, isModalOpen, isAuthenticating, authenticate]);

	// Reset auto-trigger tracking when disconnected
	useEffect(() => {
		if (!isConnected) {
			autoTriggeredForRef.current = null;
		}
	}, [isConnected]);

	return {
		authenticate,
		isAuthenticating,
	};
}

