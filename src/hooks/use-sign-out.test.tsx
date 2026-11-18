/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing
vi.mock("@tanstack/react-router", () => ({
	useNavigate: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	signOut: vi.fn(),
}));

import { useNavigate } from "@tanstack/react-router";
import { signOut } from "@/lib/auth-client";
import { useSignOut } from "./use-sign-out";

describe("useSignOut", () => {
	const mockNavigate = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useNavigate).mockReturnValue(mockNavigate);
		vi.mocked(signOut).mockResolvedValue(undefined);
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

	it("completes full sign-out flow (signOut, navigate)", async () => {
		const { result } = renderHook(() => useSignOut());

		await act(async () => {
			await result.current();
		});

		expect(signOut).toHaveBeenCalledTimes(1);
		expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
	});

	it("returns a stable callback reference", () => {
		const { result, rerender } = renderHook(() => useSignOut());
		const firstCallback = result.current;

		rerender();

		// Callback should be memoized (same reference)
		expect(result.current).toBe(firstCallback);
	});
});
