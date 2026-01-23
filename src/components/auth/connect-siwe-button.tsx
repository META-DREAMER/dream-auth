import {
	PencilSimpleIcon,
	SpinnerIcon,
	WalletIcon,
} from "@phosphor-icons/react";
import { useAccount, useEnsName } from "wagmi";
import { EnsAvatar } from "@/components/shared/ens-avatar";
import { useSimpleKit } from "@/components/simplekit";
import { Button } from "@/components/ui/button";
import { useSiweAutoTrigger } from "@/hooks/use-siwe-auto-trigger";
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
	const {
		open: openConnectModal,
		isConnected,
		isModalOpen,
		formattedAddress,
	} = useSimpleKit();
	const { address } = useAccount();
	const { data: ensName } = useEnsName({ address });

	const { authenticate, isAuthenticating } = useSiweAutoTrigger({
		isConnected: isConnected ?? false,
		isModalOpen: isModalOpen ?? false,
		onSuccess,
		onError,
	});

	// State 1: Not connected - show connect wallet button
	if (!isConnected) {
		return (
			<Button
				type="button"
				onClick={openConnectModal}
				className={cn("w-full ", className)}
				variant="outline"
			>
				<WalletIcon className="mr-2 h-4 w-4" />
				Connect Wallet
			</Button>
		);
	}

	// State 2: Connected - show sign in button (auto-trigger happens, but manual retry available)
	return (
		<Button
			type="button"
			onClick={authenticate}
			disabled={isAuthenticating}
			className={cn("w-full", className)}
			variant="outline"
		>
			{isAuthenticating ? (
				<>
					<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
					Signing...
				</>
			) : (
				<>
					<EnsAvatar address={address} ensName={ensName} className="mr-2" />
					<PencilSimpleIcon className="mr-2 h-4 w-4" />
					Sign In as {ensName || formattedAddress}
				</>
			)}
		</Button>
	);
}
