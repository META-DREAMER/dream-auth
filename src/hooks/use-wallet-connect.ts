import { useCallback } from "react";
import { useConnection, useConnect, useDisconnect, useConnectors } from "wagmi";

/**
 * Hook that wraps wagmi's wallet connection with simplified API.
 * Automatically selects the first available connector.
 */
export function useWalletConnect() {
	const { address, isConnected, chain } = useConnection();
	const connectors = useConnectors();
	const { mutate: connect, isPending: isConnecting } = useConnect();
	const { mutate: disconnect } = useDisconnect();

	const handleConnect = useCallback(() => {
		const connector = connectors[0];
		if (connector) {
			connect({ connector });
		}
	}, [connectors, connect]);

	return {
		// State
		address,
		isConnected,
		chain,
		isConnecting,
		connectors,
		// Actions
		connect: handleConnect,
		disconnect,
	};
}
