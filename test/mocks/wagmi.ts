/**
 * Type-safe mock factories for Wagmi hooks.
 *
 * These factories produce objects compatible with what vi.mocked() expects.
 * Uses Extract to get specific union members from wagmi's discriminated union types.
 */

import { mainnet } from "viem/chains";
import type {
	Connector,
	UseConnectionReturnType,
	UseDisconnectReturnType,
	UseSignMessageReturnType,
} from "wagmi";

// Extract specific union members based on the status discriminant
type ConnectedAccountState = Extract<
	UseConnectionReturnType,
	{ status: "connected" }
>;
type DisconnectedAccountState = Extract<
	UseConnectionReturnType,
	{ status: "disconnected" }
>;
type ConnectingAccountState = Extract<
	UseConnectionReturnType,
	{ status: "connecting" }
>;

// Extract idle state from mutation hooks
type IdleDisconnectState = Extract<UseDisconnectReturnType, { status: "idle" }>;
type IdleSignMessageState = Extract<
	UseSignMessageReturnType,
	{ status: "idle" }
>;

/**
 * Creates a minimal mock connector.
 * The Connector type has complex internal properties (emitter with EventEmitter).
 * We cast through unknown since tests only need the connector to exist,
 * not to have fully functional internals.
 */
function createMockConnector(): Connector {
	const noop = () => {};
	const noopAsync = async () => {};

	const mockConnector = {
		id: "mock-connector",
		name: "Mock Connector",
		type: "injected",
		connect: async () => ({ accounts: [] as `0x${string}`[], chainId: 1 }),
		disconnect: noopAsync,
		getAccounts: async () => [] as `0x${string}`[],
		getChainId: async () => 1,
		getProvider: noopAsync,
		isAuthorized: async () => true,
		onAccountsChanged: noop,
		onChainChanged: noop,
		onConnect: noop,
		onDisconnect: noop,
		setup: noopAsync,
		uid: "mock-uid",
		emitter: {
			uid: "mock-emitter-uid",
			on: () => noop,
			once: () => noop,
			off: noop,
			emit: () => false,
			listenerCount: () => 0,
		},
	};

	return mockConnector as unknown as Connector;
}

/**
 * Creates a mock for useAccount in connected state.
 */
export function createConnectedAccount(
	overrides: { address?: `0x${string}`; chainId?: number } = {},
): ConnectedAccountState {
	const address =
		overrides.address ?? "0x1234567890abcdef1234567890abcdef12345678";
	const chainId = overrides.chainId ?? 1;

	// Use mainnet as base chain, override id if needed
	const chain = chainId === 1 ? mainnet : { ...mainnet, id: chainId };

	return {
		address,
		addresses: [address],
		chain,
		chainId,
		connector: createMockConnector(),
		isConnected: true,
		isConnecting: false,
		isDisconnected: false,
		isReconnecting: false,
		status: "connected",
	};
}

/**
 * Creates a mock for useAccount in disconnected state.
 */
export function createDisconnectedAccount(): DisconnectedAccountState {
	return {
		address: undefined,
		addresses: undefined,
		chain: undefined,
		chainId: undefined,
		connector: undefined,
		isConnected: false,
		isConnecting: false,
		isDisconnected: true,
		isReconnecting: false,
		status: "disconnected",
	};
}

/**
 * Creates a mock for useAccount in connecting state.
 */
export function createConnectingAccount(): ConnectingAccountState {
	return {
		address: undefined,
		addresses: undefined,
		chain: undefined,
		chainId: undefined,
		connector: undefined,
		isConnected: false,
		isConnecting: true,
		isDisconnected: false,
		isReconnecting: false,
		status: "connecting",
	};
}

/**
 * Creates a mock for useDisconnect hook.
 */
export function createDisconnect(
	disconnect: () => void = () => {},
): IdleDisconnectState {
	const noop = () => {};
	const noopAsync = async () => {};

	return {
		disconnect,
		disconnectAsync: noopAsync,
		connectors: [],
		isPending: false,
		isError: false,
		isIdle: true,
		isSuccess: false,
		isPaused: false,
		error: null,
		data: undefined,
		reset: noop,
		status: "idle",
		failureCount: 0,
		failureReason: null,
		variables: undefined,
		context: undefined,
		submittedAt: 0,
		mutate: noop as IdleDisconnectState["mutate"],
		mutateAsync: noopAsync as IdleDisconnectState["mutateAsync"],
	};
}

/**
 * Creates a mock for useSignMessage hook.
 */
export function createSignMessage(
	signMessageAsyncFn: (args: { message: string }) => Promise<`0x${string}`>,
): IdleSignMessageState {
	const noop = () => {};

	return {
		signMessage: noop as IdleSignMessageState["signMessage"],
		signMessageAsync:
			signMessageAsyncFn as IdleSignMessageState["signMessageAsync"],
		mutate: noop as IdleSignMessageState["mutate"],
		mutateAsync: signMessageAsyncFn as IdleSignMessageState["mutateAsync"],
		data: undefined,
		error: null,
		isError: false,
		isIdle: true,
		isPending: false,
		isSuccess: false,
		isPaused: false,
		reset: noop,
		status: "idle",
		failureCount: 0,
		failureReason: null,
		variables: undefined,
		context: undefined,
		submittedAt: 0,
	};
}
