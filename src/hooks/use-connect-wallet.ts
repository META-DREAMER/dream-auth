import { useCallback } from "react";
import {
	useAccount,
	useConnect,
	useDisconnect,
	useConnectors,
	type Connector,
} from "wagmi";

/**
 * Hook that wraps wagmi's wallet connection with simplified API.
 * Exposes all available connectors so user can select which one to use.
 */
export function useConnectWallet() {
	const { address, isConnected, chain } = useAccount();
	const connectors = useConnectors();
	const { mutate: connect, isPending: isConnecting } = useConnect();
	const { mutate: disconnect } = useDisconnect();

	const connectWithConnector = useCallback(
		(connector: Connector) => {
			connect({ connector });
		},
		[connect],
	);

	return {
		// State
		address,
		isConnected,
		chain,
		isConnecting,
		connectors,
		// Actions
		connect: connectWithConnector,
		disconnect,
	};
}
