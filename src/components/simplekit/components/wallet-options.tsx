"use client";

import * as React from "react";
import { SimpleKitContext } from "../simplekit-context";
import { useConnectors } from "../use-connectors";
import { WalletOption } from "./wallet-option";

export function WalletOptions() {
	const context = React.useContext(SimpleKitContext);
	const { connectors, connect } = useConnectors();

	return (
		<div className="flex flex-col gap-3.5">
			{connectors.map((connector) => (
				<WalletOption
					key={connector.uid}
					connector={connector}
					onClick={() => {
						context.setIsConnectorError(false);
						context.setPendingConnector(connector);
						connect({ connector });
					}}
				/>
			))}
		</div>
	);
}
