"use client";

import { WalletIcon } from "@phosphor-icons/react";
import { useAccount, useEnsName } from "wagmi";
import { EnsAvatar } from "@/components/shared/ens-avatar";
import { Button } from "@/components/ui/button";
import { useSimpleKit } from "./use-simple-kit";

export function ConnectWalletButton({ className }: { className?: string }) {
	const simplekit = useSimpleKit();
	const { address } = useAccount();
	const { data: ensName } = useEnsName({ address });

	return (
		<Button
			onClick={simplekit.toggleModal}
			className={className ?? "rounded-xl"}
			variant="outline"
		>
			{simplekit.isConnected ? (
				<>
					<EnsAvatar address={address} ensName={ensName} className="mr-2" />
					{address && (
						<span>{ensName ? `${ensName}` : simplekit.formattedAddress}</span>
					)}
				</>
			) : (
				<>
					<WalletIcon className="mr-2 h-4 w-4" />
					Connect Wallet
				</>
			)}
		</Button>
	);
}
