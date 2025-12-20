import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import {
	baseAccount,
	injected,
	porto,
	safe,
	walletConnect,
} from "wagmi/connectors";
import { clientEnv } from "@/env.client";

export const wagmiConfig = createConfig({
	chains: [mainnet],
	connectors: [
		injected(),
		porto(),
		safe(),
		baseAccount({ appName: "Dream Auth", preference: {telemetry: false, }  }),
		...(clientEnv.VITE_WALLETCONNECT_PROJECT_ID
			? [
					walletConnect({
						projectId: clientEnv.VITE_WALLETCONNECT_PROJECT_ID,
						showQrModal: true,
					}),
				]
			: []),
	],
	transports: {
		[mainnet.id]: http(),
	},
});
