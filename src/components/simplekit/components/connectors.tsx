"use client";

import * as React from "react";
import { SimpleKitContext } from "../simplekit-context";
import {
	SimpleKitModalBody,
	SimpleKitModalDescription,
	SimpleKitModalFooter,
	SimpleKitModalHeader,
	SimpleKitModalTitle,
} from "../simplekit-modal";
import { BackChevron } from "./ui-components";
import { WalletConnecting } from "./wallet-connecting";
import { WalletOptions } from "./wallet-options";

export function Connectors() {
	const context = React.useContext(SimpleKitContext);

	return (
		<>
			<SimpleKitModalHeader>
				<BackChevron />
				<SimpleKitModalTitle>
					{context.pendingConnector?.name ?? "Connect Wallet"}
				</SimpleKitModalTitle>
				<SimpleKitModalDescription className="sr-only">
					Connect your Web3 wallet or create a new one.
				</SimpleKitModalDescription>
			</SimpleKitModalHeader>
			<SimpleKitModalBody>
				{context.pendingConnector ? <WalletConnecting /> : <WalletOptions />}
			</SimpleKitModalBody>
			<SimpleKitModalFooter>
				<div className="h-0" />
			</SimpleKitModalFooter>
		</>
	);
}
