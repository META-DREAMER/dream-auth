/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing
vi.mock("@tanstack/react-router", () => ({
	useNavigate: vi.fn(),
}));

vi.mock("wagmi", () => ({
	useDisconnect: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	signOut: vi.fn(),
}));

import { useNavigate } from "@tanstack/react-router";
import { useDisconnect } from "wagmi";
import { signOut } from "@/lib/auth-client";
import { useSignOut } from "./use-sign-out";

describe("useSignOut", () => {
	const mockNavigate = vi.fn();
	const mockDisconnect = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useNavigate).mockReturnValue(mockNavigate);
		vi.mocked(useDisconnect).mockReturnValue({
			disconnect: mockDisconnect,
		} as unknown as ReturnType<typeof useDisconnect>);
		vi.mocked(signOut).mockResolvedValue(undefined);
	});

	it("disconnects wallet when signing out", async () => {
		const { result } = renderHook(() => useSignOut());

		await act(async () => {
			await result.current();
		});

		expect(mockDisconnect).toHaveBeenCalledTimes(1);
	});

	it("calls signOut function", async () => {
		const { result } = renderHook(() => useSignOut());

		await act(async () => {
			await result.current();
		});

		expect(signOut).toHaveBeenCalledTimes(1);
	});

	it("navigates to /login after signing out", async () => {
		const { result } = renderHook(() => useSignOut());

		await act(async () => {
			await result.current();
		});

		expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
	});

	it("disconnects, signs out, and navigates in order", async () => {
		const callOrder: string[] = [];

		mockDisconnect.mockImplementation(() => {
			callOrder.push("disconnect");
		});
		vi.mocked(signOut).mockImplementation(async () => {
			callOrder.push("signOut");
		});
		mockNavigate.mockImplementation(() => {
			callOrder.push("navigate");
		});

		const { result } = renderHook(() => useSignOut());

		await act(async () => {
			await result.current();
		});

		// disconnect is called first (sync), then signOut (async), then navigate (sync)
		expect(callOrder).toEqual(["disconnect", "signOut", "navigate"]);
	});

	it("returns a stable callback reference", () => {
		const { result, rerender } = renderHook(() => useSignOut());
		const firstCallback = result.current;

		rerender();

		// Callback should be memoized (same reference)
		expect(result.current).toBe(firstCallback);
	});
});
