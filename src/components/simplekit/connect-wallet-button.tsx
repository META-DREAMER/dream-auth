"use client";

import { useAccount, useEnsAvatar, useEnsName } from "wagmi";
import { Button } from "@/components/ui/button";
import { useSimpleKit } from "./use-simple-kit";
import { Wallet } from "lucide-react";

export function ConnectWalletButton({ className }: { className?: string }) {
  const simplekit = useSimpleKit();
  const { address } = useAccount();
  const { data: ensName } = useEnsName({ address });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName! });

  return (
    <Button onClick={simplekit.toggleModal} className={className ?? "rounded-xl"} variant="outline">
      {simplekit.isConnected ? (
        <>
          {ensAvatar && <img src={ensAvatar} alt="ENS Avatar" />}
          {address && (
            <span>{ensName ? `${ensName}` : simplekit.formattedAddress}</span>
          )}
        </>
      ) : (
        <>
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </>
      )}
    </Button>
  );
}
