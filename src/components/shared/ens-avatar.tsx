import { useAccount, useEnsAvatar, useEnsName } from "wagmi";
import { cn } from "@/lib/utils";

interface EnsAvatarProps {
	/** Wallet address */
	address?: string;
	/** Size class (default: "h-4 w-4") */
	size?: string;
	/** Additional className */
	className?: string;
	/** Fallback ENS name if address is not available */
	ensName?: string | null;
}

/**
 * Unified ENS avatar component with safe rendering.
 * Handles null checks and provides consistent styling.
 */
export function EnsAvatar({
	address,
	size = "h-4 w-4",
	className,
	ensName: providedEnsName,
}: EnsAvatarProps) {
	const { address: accountAddress } = useAccount();
	const targetAddress = address ?? accountAddress;

	const { data: ensName } = useEnsName({
		address: targetAddress as `0x${string}`,
	});
	const { data: ensAvatar } = useEnsAvatar({
		name: providedEnsName ?? ensName ?? undefined,
	});

	if (!ensAvatar) {
		return null;
	}

	return (
		<img
			src={ensAvatar}
			alt="ENS Avatar"
			className={cn("rounded-full", size, className)}
		/>
	);
}
