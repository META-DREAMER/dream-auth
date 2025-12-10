import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { SimpleKitProvider } from "@/components/simplekit";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60, // 1 minute
			retry: 1,
		},
	},
});

export function Web3Provider(props: { children: React.ReactNode }) {
	return (
		<WagmiProvider config={wagmiConfig}>
			<QueryClientProvider client={queryClient}>
				<SimpleKitProvider>{props.children}</SimpleKitProvider>
			</QueryClientProvider>
		</WagmiProvider>
	);
}
