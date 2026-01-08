import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Creates a wrapper component with QueryClient for testing hooks.
 */
export function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

/**
 * Creates a QueryClient instance for testing.
 */
export function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: 0,
			},
			mutations: {
				retry: false,
			},
		},
	});
}

/**
 * Waits for the next tick (microtask queue to flush).
 */
export function waitForNextTick(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Waits for a specified duration.
 */
export function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
