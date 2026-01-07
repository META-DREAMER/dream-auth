import * as React from "react";
import type { Connector } from "wagmi";

export interface SimpleKitContextType {
	pendingConnector: Connector | null;
	setPendingConnector: React.Dispatch<React.SetStateAction<Connector | null>>;
	isConnectorError: boolean;
	setIsConnectorError: React.Dispatch<React.SetStateAction<boolean>>;
	open: boolean;
	setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SimpleKitContext = React.createContext<SimpleKitContextType>({
	pendingConnector: null,
	setPendingConnector: () => null,
	isConnectorError: false,
	setIsConnectorError: () => false,
	open: false,
	setOpen: () => false,
});
