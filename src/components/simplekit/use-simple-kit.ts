"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { SimpleKitContext } from "./simplekit-context";

export function useSimpleKit() {
  const { address } = useAccount();
  const context = React.useContext(SimpleKitContext);

  const isModalOpen = context.open;
  const isConnected = address && !context.pendingConnector;
  const formattedAddress = address?.slice(0, 6) + "•••" + address?.slice(-4);

  function open() {
    context.setOpen(true);
  }

  function close() {
    context.setOpen(false);
  }

  function toggleModal() {
    context.setOpen((prevState) => !prevState);
  }

  return {
    isModalOpen,
    isConnected,
    formattedAddress,
    open,
    close,
    toggleModal,
  };
}
