/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing
vi.mock("wagmi", () => ({
	useAccount: vi.fn(),
}));

vi.mock("./use-siwe-auth", () => ({
	useSiweAuth: vi.fn(),
}));

import { useAccount } from "wagmi";
import { createConnectedAccount, createDisconnectedAccount } from "@test/mocks/wagmi";
import { useSiweAuth } from "./use-siwe-auth";
import { useSiweAutoTrigger } from "./use-siwe-auto-trigger";

describe("useSiweAutoTrigger", () => {
	const mockAuthenticate = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();

		vi.mocked(useAccount).mockReturnValue(createConnectedAccount());

		vi.mocked(useSiweAuth).mockReturnValue({
			authenticate: mockAuthenticate,
			isAuthenticating: false,
			error: null,
			clearError: vi.fn(),
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("auto-triggers authentication when connected and modal closed", async () => {
		renderHook(() =>
			useSiweAutoTrigger({
				isConnected: true,
				isModalOpen: false,
			}),
		);

		// Advance timer past the 300ms delay
		await act(async () => {
			vi.advanceTimersByTime(300);
		});

		expect(mockAuthenticate).toHaveBeenCalledTimes(1);
	});

	it("does not auto-trigger when disabled", async () => {
		renderHook(() =>
			useSiweAutoTrigger({
				isConnected: true,
				isModalOpen: false,
				enabled: false,
			}),
		);

		await act(async () => {
			vi.advanceTimersByTime(500);
		});

		expect(mockAuthenticate).not.toHaveBeenCalled();
	});

	it("does not auto-trigger when not connected", async () => {
		renderHook(() =>
			useSiweAutoTrigger({
				isConnected: false,
				isModalOpen: false,
			}),
		);

		await act(async () => {
			vi.advanceTimersByTime(500);
		});

		expect(mockAuthenticate).not.toHaveBeenCalled();
	});

	it("does not auto-trigger when modal is open", async () => {
		renderHook(() =>
			useSiweAutoTrigger({
				isConnected: true,
				isModalOpen: true,
			}),
		);

		await act(async () => {
			vi.advanceTimersByTime(500);
		});

		expect(mockAuthenticate).not.toHaveBeenCalled();
	});

	it("does not auto-trigger when already authenticating", async () => {
		vi.mocked(useSiweAuth).mockReturnValue({
			authenticate: mockAuthenticate,
			isAuthenticating: true,
			error: null,
			clearError: vi.fn(),
		});

		renderHook(() =>
			useSiweAutoTrigger({
				isConnected: true,
				isModalOpen: false,
			}),
		);

		await act(async () => {
			vi.advanceTimersByTime(500);
		});

		expect(mockAuthenticate).not.toHaveBeenCalled();
	});

	it("does not auto-trigger when no address", async () => {
		vi.mocked(useAccount).mockReturnValue(createDisconnectedAccount());

		renderHook(() =>
			useSiweAutoTrigger({
				isConnected: true,
				isModalOpen: false,
			}),
		);

		await act(async () => {
			vi.advanceTimersByTime(500);
		});

		expect(mockAuthenticate).not.toHaveBeenCalled();
	});

	it("triggers only once per address (prevents loop)", async () => {
		const { rerender } = renderHook(
			(props) =>
				useSiweAutoTrigger({
					isConnected: props?.isConnected ?? true,
					isModalOpen: false,
				}),
			{ initialProps: { isConnected: true } },
		);

		await act(async () => {
			vi.advanceTimersByTime(300);
		});

		expect(mockAuthenticate).toHaveBeenCalledTimes(1);

		// Trigger another render with same props
		rerender({ isConnected: true });

		await act(async () => {
			vi.advanceTimersByTime(500);
		});

		// Should still be 1 call (not triggered again)
		expect(mockAuthenticate).toHaveBeenCalledTimes(1);
	});

	it("resets tracking when disconnected", async () => {
		const { rerender } = renderHook(
			(props) =>
				useSiweAutoTrigger({
					isConnected: props?.isConnected ?? true,
					isModalOpen: false,
				}),
			{ initialProps: { isConnected: true } },
		);

		// First trigger
		await act(async () => {
			vi.advanceTimersByTime(300);
		});
		expect(mockAuthenticate).toHaveBeenCalledTimes(1);

		// Disconnect
		rerender({ isConnected: false });

		await act(async () => {
			vi.advanceTimersByTime(100);
		});

		// Reconnect
		rerender({ isConnected: true });

		await act(async () => {
			vi.advanceTimersByTime(300);
		});

		// Should trigger again after disconnect/reconnect
		expect(mockAuthenticate).toHaveBeenCalledTimes(2);
	});

	it("triggers again when address changes", async () => {
		const { rerender } = renderHook(
			(props) =>
				useSiweAutoTrigger({
					isConnected: props?.isConnected ?? true,
					isModalOpen: false,
				}),
			{ initialProps: { isConnected: true } },
		);

		await act(async () => {
			vi.advanceTimersByTime(300);
		});
		expect(mockAuthenticate).toHaveBeenCalledTimes(1);

		// Change address
		vi.mocked(useAccount).mockReturnValue(
			createConnectedAccount({ address: "0xaabbccdd0011223344556677889900aabbccddee" }),
		);

		rerender({ isConnected: true });

		await act(async () => {
			vi.advanceTimersByTime(300);
		});

		// Should trigger for new address
		expect(mockAuthenticate).toHaveBeenCalledTimes(2);
	});

	it("calls onSuccess callback on success", async () => {
		const onSuccess = vi.fn();

		vi.mocked(useSiweAuth).mockImplementation((options) => {
			// Simulate calling onSuccess when authenticate is called
			mockAuthenticate.mockImplementation(async () => {
				options?.onSuccess?.();
				return true;
			});
			return {
				authenticate: mockAuthenticate,
				isAuthenticating: false,
				error: null,
				clearError: vi.fn(),
			};
		});

		renderHook(() =>
			useSiweAutoTrigger({
				isConnected: true,
				isModalOpen: false,
				onSuccess,
			}),
		);

		await act(async () => {
			vi.advanceTimersByTime(300);
		});

		expect(onSuccess).toHaveBeenCalled();
	});

	it("calls onError callback on error", async () => {
		const onError = vi.fn();

		vi.mocked(useSiweAuth).mockImplementation((options) => {
			mockAuthenticate.mockImplementation(async () => {
				options?.onError?.("Test error");
				return false;
			});
			return {
				authenticate: mockAuthenticate,
				isAuthenticating: false,
				error: null,
				clearError: vi.fn(),
			};
		});

		renderHook(() =>
			useSiweAutoTrigger({
				isConnected: true,
				isModalOpen: false,
				onError,
			}),
		);

		await act(async () => {
			vi.advanceTimersByTime(300);
		});

		expect(onError).toHaveBeenCalledWith("Test error");
	});

	it("cleans up timer on unmount", async () => {
		const { unmount } = renderHook(() =>
			useSiweAutoTrigger({
				isConnected: true,
				isModalOpen: false,
			}),
		);

		// Unmount before timer fires
		unmount();

		await act(async () => {
			vi.advanceTimersByTime(500);
		});

		// Should not have been called since component unmounted
		expect(mockAuthenticate).not.toHaveBeenCalled();
	});

	it("returns authenticate and isAuthenticating from useSiweAuth", () => {
		vi.mocked(useSiweAuth).mockReturnValue({
			authenticate: mockAuthenticate,
			isAuthenticating: true,
			error: null,
			clearError: vi.fn(),
		});

		const { result } = renderHook(() =>
			useSiweAutoTrigger({
				isConnected: true,
				isModalOpen: false,
			}),
		);

		expect(result.current.authenticate).toBe(mockAuthenticate);
		expect(result.current.isAuthenticating).toBe(true);
	});
});
