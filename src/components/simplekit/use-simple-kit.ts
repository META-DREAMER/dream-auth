"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { formatAddress } from "@/lib/format";
import { SimpleKitContext } from "./simplekit-context";

export function useSimpleKit() {
	const { address } = useAccount();
	const context = React.useContext(SimpleKitContext);

	const isModalOpen = context.open;
	const isConnected = address && !context.pendingConnector;
	const formattedAddress = formatAddress(address);

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
