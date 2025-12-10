import { http, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { clientEnv } from "@/env.client";
/**
 * Wagmi configuration for wallet connectivity.
 * Uses injected connectors (MetaMask, Coinbase Wallet, etc.)
 * and optionally WalletConnect for mobile wallet support.
 */
export const wagmiConfig = createConfig({
	chains: [mainnet],
	connectors: [
		// Injected wallets (MetaMask, Coinbase Wallet, Brave, etc.)
		injected(),
		// WalletConnect requires a valid projectId - only add if configured
		...(clientEnv.VITE_WALLETCONNECT_PROJECT_ID
			? [walletConnect({ projectId: clientEnv.VITE_WALLETCONNECT_PROJECT_ID })]
			: []),
	],
	transports: {
		[mainnet.id]: http(),
	},
});

