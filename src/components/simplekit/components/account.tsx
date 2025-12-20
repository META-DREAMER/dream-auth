"use client";

import * as React from "react";
import { useAccount, useDisconnect, useEnsName, useBalance } from "wagmi";
import { formatEther } from "viem";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/lib/format";
import { SimpleKitContext } from "../simplekit-context";
import {
  SimpleKitModalBody,
  SimpleKitModalDescription,
  SimpleKitModalHeader,
  SimpleKitModalTitle,
} from "../simplekit-modal";
import { CopyAddressButton } from "./ui-components";

const MODAL_CLOSE_DURATION = 320;

export function Account() {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address });
  const { data: userBalance } = useBalance({ address });
  const context = React.useContext(SimpleKitContext);

  const formattedAddress = formatAddress(address);
  const formattedUserBalace = userBalance?.value
    ? parseFloat(formatEther(userBalance.value)).toFixed(4)
    : undefined;

  function handleDisconnect() {
    context.setOpen(false);
    setTimeout(() => {
      disconnect();
    }, MODAL_CLOSE_DURATION);
  }

  return (
    <>
      <SimpleKitModalHeader>
        <SimpleKitModalTitle>Connected</SimpleKitModalTitle>
        <SimpleKitModalDescription className="sr-only">
          Account modal for your connected Web3 wallet.
        </SimpleKitModalDescription>
      </SimpleKitModalHeader>
      <SimpleKitModalBody className="h-[280px]">
        <div className="flex w-full flex-col items-center justify-center gap-8 md:pt-5">
          <div className="size-24 flex items-center justify-center">
            <img
              className="rounded-full"
              src={`https://avatar.vercel.sh/${address}?size=150`}
              alt="User gradient avatar"
            />
          </div>
          <div className="space-y-1 px-3.5 text-center sm:px-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-semibold">
                <div>{ensName ? `${ensName}` : formattedAddress}</div>
              </h1>
              <CopyAddressButton />
            </div>
            <p className="text-balance text-sm text-muted-foreground">
              {`${formattedUserBalace ?? "0.00"} ETH`}
            </p>
          </div>
          <Button className="w-full rounded-xl" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      </SimpleKitModalBody>
    </>
  );
}
