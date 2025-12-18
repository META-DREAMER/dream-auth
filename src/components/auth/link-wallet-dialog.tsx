import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, PenLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSiweAuth } from "@/hooks/use-siwe-auth";
import { useSimpleKit } from "@/components/simplekit";
import { useAccount, useDisconnect } from "wagmi";

/**
 * Button component for linking a new wallet to an existing account.
 * Uses SimpleKit for connection and SIWE for verification.
 * 
 * Flow:
 * 1. User clicks "Link Wallet" - opens connect modal
 * 2. After connecting, auto-triggers SIWE (with manual retry available)
 * 3. User signs SIWE message to complete linking
 * 
 * Auto-triggers once per linking attempt, with manual retry always available.
 */
export function LinkWalletDialog() {
	const queryClient = useQueryClient();
	const { open: openConnectModal, isConnected, isModalOpen, formattedAddress } = useSimpleKit();
	const { address } = useAccount();
	const { disconnect } = useDisconnect();
	const [isLinkingFlow, setIsLinkingFlow] = useState(false);

	// Track if we've auto-triggered for this linking flow
	const autoTriggeredRef = useRef(false);

	const { authenticate, isAuthenticating } = useSiweAuth({
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["linked-accounts"] });
			setIsLinkingFlow(false);
			autoTriggeredRef.current = false;
			// Disconnect so user can link another wallet
			disconnect();
		},
		onError: () => {
			// Keep isLinkingFlow true so user can see the retry button
		},
		disconnectOnError: true,
	});

	// Auto-trigger SIWE when wallet connects during linking flow
	useEffect(() => {
		if (
			isLinkingFlow &&
			isConnected &&
			address &&
			!isModalOpen &&
			!isAuthenticating &&
			!autoTriggeredRef.current
		) {
			// Mark as auto-triggered for this flow
			autoTriggeredRef.current = true;
			// Small delay to let modal close animation complete
			const timer = setTimeout(() => {
				authenticate();
			}, 300);
			return () => clearTimeout(timer);
		}
	}, [isLinkingFlow, isConnected, address, isModalOpen, isAuthenticating, authenticate]);

	// Start linking flow - disconnect any existing wallet, then open connect modal
	const handleStartLinking = () => {
		setIsLinkingFlow(true);
		autoTriggeredRef.current = false;
		// Disconnect any existing wallet to ensure fresh connection for linking
		if (isConnected) {
			disconnect();
		}
		openConnectModal();
	};

	// Complete linking - sign SIWE message (manual trigger)
	const handleSignToLink = () => {
		authenticate();
	};

	// Cancel linking flow
	const handleCancel = () => {
		setIsLinkingFlow(false);
		autoTriggeredRef.current = false;
	};

	// State: Connected and in linking flow - show sign button with cancel option
	if (isConnected && isLinkingFlow) {
		return (
			<div className="flex gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={handleSignToLink}
					disabled={isAuthenticating}
				>
					{isAuthenticating ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Linking...
						</>
					) : (
						<>
							<PenLine className="mr-2 h-4 w-4" />
							Sign to Link {formattedAddress}
						</>
					)}
				</Button>
				{!isAuthenticating && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleCancel}
					>
						Cancel
					</Button>
				)}
			</div>
		);
	}

	// Default state: Always show "Link Wallet" to start fresh connection
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			onClick={handleStartLinking}
			disabled={isAuthenticating}
		>
			<Plus className="mr-2 h-4 w-4" />
			Link Wallet
		</Button>
	);
}
