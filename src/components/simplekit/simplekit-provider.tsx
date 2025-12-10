"use client";

import * as React from "react";
import { useAccount, type Connector } from "wagmi";
import { SimpleKitContext } from "./simplekit-context";
import { SimpleKitModal, SimpleKitModalContent } from "./simplekit-modal";
import { Account } from "./components/account";
import { Connectors } from "./components/connectors";

const MODAL_CLOSE_DURATION = 320;

export function SimpleKitProvider(props: { children: React.ReactNode }) {
  const { status, address } = useAccount();
  const [pendingConnector, setPendingConnector] =
    React.useState<Connector | null>(null);
  const [isConnectorError, setIsConnectorError] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const isConnected = address && !pendingConnector;

  React.useEffect(() => {
    if (status === "connected" && pendingConnector) {
      setOpen(false);
      const timeout = setTimeout(() => {
        setPendingConnector(null);
        setIsConnectorError(false);
      }, MODAL_CLOSE_DURATION);
      return () => clearTimeout(timeout);
    }
  }, [status, setOpen, pendingConnector, setPendingConnector]);

  return (
    <SimpleKitContext.Provider
      value={{
        pendingConnector,
        setPendingConnector,
        isConnectorError,
        setIsConnectorError,
        open,
        setOpen,
      }}
    >
      {props.children}
      <SimpleKitModal open={open} onOpenChange={setOpen}>
        <SimpleKitModalContent>
          {isConnected ? <Account /> : <Connectors />}
        </SimpleKitModalContent>
      </SimpleKitModal>
    </SimpleKitContext.Provider>
  );
}
