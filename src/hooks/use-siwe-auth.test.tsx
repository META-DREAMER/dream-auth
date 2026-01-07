/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing
vi.mock("wagmi", () => ({
	useAccount: vi.fn(),
	useDisconnect: vi.fn(),
	useSignMessage: vi.fn(),
}));

vi.mock("viem/siwe", () => ({
	createSiweMessage: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	siwe: {
		nonce: vi.fn(),
		verify: vi.fn(),
	},
}));

vi.mock("@/env.client", () => ({
	clientEnv: {
		VITE_AUTH_URL: "https://auth.example.com",
	},
}));

import {
	createConnectedAccount,
	createDisconnect,
	createDisconnectedAccount,
	createSignMessage,
} from "@test/mocks/wagmi";
import { createSiweMessage } from "viem/siwe";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { siwe } from "@/lib/auth-client";
import { useSiweAuth } from "./use-siwe-auth";

describe("useSiweAuth", () => {
	const mockDisconnect = vi.fn();
	const mockSignMessageAsync = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();

		vi.mocked(useAccount).mockReturnValue(createConnectedAccount());
		vi.mocked(useDisconnect).mockReturnValue(createDisconnect(mockDisconnect));
		vi.mocked(useSignMessage).mockReturnValue(
			createSignMessage(mockSignMessageAsync),
		);
		vi.mocked(createSiweMessage).mockReturnValue("mock-siwe-message");
	});

	it("returns isAuthenticating false initially", () => {
		const { result } = renderHook(() => useSiweAuth());

		expect(result.current.isAuthenticating).toBe(false);
		expect(result.current.error).toBeNull();
	});

	it("sets error when wallet not connected (no address)", async () => {
		vi.mocked(useAccount).mockReturnValue(createDisconnectedAccount());

		const { result } = renderHook(() => useSiweAuth());

		await act(async () => {
			const success = await result.current.authenticate();
			expect(success).toBe(false);
		});

		expect(result.current.error).toBe("Wallet not connected");
	});

	it("sets error when wallet not connected (no chain)", async () => {
		const accountWithNoChain = {
			...createConnectedAccount(),
			chain: undefined,
		};
		vi.mocked(useAccount).mockReturnValue(accountWithNoChain);

		const { result } = renderHook(() => useSiweAuth());

		await act(async () => {
			const success = await result.current.authenticate();
			expect(success).toBe(false);
		});

		expect(result.current.error).toBe("Wallet not connected");
	});

	it("completes SIWE authentication flow successfully", async () => {
		vi.mocked(siwe.nonce).mockResolvedValue({
			data: { nonce: "test-nonce" },
			error: null,
		});
		mockSignMessageAsync.mockResolvedValue("0xsignature");
		vi.mocked(siwe.verify).mockResolvedValue({
			data: { session: {} },
			error: null,
		});

		const onSuccess = vi.fn();
		const { result } = renderHook(() => useSiweAuth({ onSuccess }));

		await act(async () => {
			const success = await result.current.authenticate();
			expect(success).toBe(true);
		});

		// Verify the flow
		expect(siwe.nonce).toHaveBeenCalledWith({
			walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
			chainId: 1,
		});
		expect(createSiweMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				domain: "auth.example.com",
				address: "0x1234567890abcdef1234567890abcdef12345678",
				nonce: "test-nonce",
				chainId: 1,
			}),
		);
		expect(mockSignMessageAsync).toHaveBeenCalledWith({
			message: "mock-siwe-message",
		});
		expect(siwe.verify).toHaveBeenCalledWith({
			message: "mock-siwe-message",
			signature: "0xsignature",
			walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
			chainId: 1,
		});
		expect(onSuccess).toHaveBeenCalled();
	});

	it("handles nonce generation error", async () => {
		vi.mocked(siwe.nonce).mockResolvedValue({
			data: null,
			error: { message: "Nonce generation failed" },
		});

		const onError = vi.fn();
		const { result } = renderHook(() => useSiweAuth({ onError }));

		await act(async () => {
			const success = await result.current.authenticate();
			expect(success).toBe(false);
		});

		expect(result.current.error).toBe("Nonce generation failed");
		expect(onError).toHaveBeenCalledWith("Nonce generation failed");
		expect(mockDisconnect).toHaveBeenCalled();
	});

	it("handles verification error", async () => {
		vi.mocked(siwe.nonce).mockResolvedValue({
			data: { nonce: "test-nonce" },
			error: null,
		});
		mockSignMessageAsync.mockResolvedValue("0xsignature");
		vi.mocked(siwe.verify).mockResolvedValue({
			data: null,
			error: { message: "Signature verification failed" },
		});

		const onError = vi.fn();
		const { result } = renderHook(() => useSiweAuth({ onError }));

		await act(async () => {
			const success = await result.current.authenticate();
			expect(success).toBe(false);
		});

		expect(result.current.error).toBe("Signature verification failed");
		expect(onError).toHaveBeenCalledWith("Signature verification failed");
	});

	it("disconnects wallet on error by default", async () => {
		vi.mocked(siwe.nonce).mockResolvedValue({
			data: null,
			error: { message: "Failed" },
		});

		const { result } = renderHook(() => useSiweAuth());

		await act(async () => {
			await result.current.authenticate();
		});

		expect(mockDisconnect).toHaveBeenCalled();
	});

	it("does not disconnect wallet on error when disconnectOnError is false", async () => {
		vi.mocked(siwe.nonce).mockResolvedValue({
			data: null,
			error: { message: "Failed" },
		});

		const { result } = renderHook(() =>
			useSiweAuth({ disconnectOnError: false }),
		);

		await act(async () => {
			await result.current.authenticate();
		});

		expect(mockDisconnect).not.toHaveBeenCalled();
	});

	it("clears error with clearError function", async () => {
		vi.mocked(siwe.nonce).mockResolvedValue({
			data: null,
			error: { message: "Test error" },
		});

		const { result } = renderHook(() => useSiweAuth());

		await act(async () => {
			await result.current.authenticate();
		});

		expect(result.current.error).toBe("Test error");

		act(() => {
			result.current.clearError();
		});

		expect(result.current.error).toBeNull();
	});

	it("handles exception thrown during nonce generation", async () => {
		vi.mocked(siwe.nonce).mockRejectedValue(new Error("Connection refused"));

		const { result } = renderHook(() => useSiweAuth());

		await act(async () => {
			const success = await result.current.authenticate();
			expect(success).toBe(false);
		});

		expect(result.current.error).toBe("Connection refused");
	});

	it("handles non-Error thrown during authentication", async () => {
		vi.mocked(siwe.nonce).mockRejectedValue("string error");

		const { result } = renderHook(() => useSiweAuth());

		await act(async () => {
			const success = await result.current.authenticate();
			expect(success).toBe(false);
		});

		expect(result.current.error).toBe("Authentication failed");
	});
});
