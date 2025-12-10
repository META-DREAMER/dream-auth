import { useEffect, useRef } from "react";
import { Loader2, Wallet, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSimpleKit } from "@/components/simplekit";
import { useSiweAuth } from "@/hooks/use-siwe-auth";
import { useAccount, useEnsName, useEnsAvatar } from "wagmi";
import { cn } from "@/lib/utils";

interface ConnectSIWEButtonProps {
	onSuccess?: () => void;
	onError?: (error: string) => void;
	className?: string;
}

/**
 * A button that handles the full SIWE authentication flow:
 * - If not connected: shows "Connect Wallet" button
 * - If connected but not authenticated: auto-triggers SIWE, shows "Sign In" button for manual retry
 * 
 * Auto-triggers once per address, with manual retry always available.
 */
export function ConnectSIWEButton({
	onSuccess,
	onError,
	className,
}: ConnectSIWEButtonProps) {
	const { open: openConnectModal, isConnected, isModalOpen, formattedAddress } = useSimpleKit();
	const { address } = useAccount();
	const { data: ensName } = useEnsName({ address });
	const { data: ensAvatar } = useEnsAvatar({ name: ensName! });
	
	const { authenticate, isAuthenticating } = useSiweAuth({
		onSuccess,
		onError,
	});

	// Track which address we've auto-triggered for to prevent loops
	const autoTriggeredForRef = useRef<string | null>(null);

	// Auto-trigger SIWE when wallet connects (once per address)
	useEffect(() => {
		if (
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
	}, [isConnected, address, isModalOpen, isAuthenticating, authenticate]);

	// Reset auto-trigger tracking when disconnected
	useEffect(() => {
		if (!isConnected) {
			autoTriggeredForRef.current = null;
		}
	}, [isConnected]);

	// State 1: Not connected - show connect wallet button
	if (!isConnected) {
		return (
			<Button
				onClick={openConnectModal}
				className={cn("w-full ", className)}
				variant="outline"
			>
				<Wallet className="mr-2 h-4 w-4" />
				Connect Wallet
			</Button>
		);
	}

	// State 2: Connected - show sign in button (auto-trigger happens, but manual retry available)
	return (
		<Button
			onClick={authenticate}
			disabled={isAuthenticating}
			className={cn("w-full border-zinc-700 bg-zinc-800/50 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-50", className)}
			variant="outline"
		>
			{isAuthenticating ? (
				<>
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					Signing...
				</>
			) : (
				<>
					{ensAvatar && (
						<img 
							src={ensAvatar} 
							alt="ENS Avatar" 
							className="mr-2 h-4 w-4 rounded-full"
						/>
					)}
					<PenLine className="mr-2 h-4 w-4" />
					Sign In as {ensName || formattedAddress}
				</>
			)}
		</Button>
	);
}
