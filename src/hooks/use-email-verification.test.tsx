/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing
vi.mock("@tanstack/react-router", () => ({
	useRouter: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		changeEmail: vi.fn(),
		emailOtp: {
			sendVerificationOtp: vi.fn(),
			verifyEmail: vi.fn(),
		},
	},
}));

import { useRouter } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useEmailVerification } from "./use-email-verification";

describe("useEmailVerification", () => {
	const mockInvalidate = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers({ shouldAdvanceTime: true });

		vi.mocked(useRouter).mockReturnValue({
			invalidate: mockInvalidate,
		} as unknown as ReturnType<typeof useRouter>);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("initializes with correct default state", () => {
		const { result } = renderHook(() =>
			useEmailVerification({ email: "test@example.com" }),
		);

		expect(result.current.otp).toBe("");
		expect(result.current.error).toBeNull();
		expect(result.current.isLoading).toBe(false);
		expect(result.current.hasSentOtp).toBe(false);
		expect(result.current.canResend).toBe(true);
		expect(result.current.secondsUntilResend).toBe(0);
	});

	describe("countdown timer", () => {
		it("decrements secondsUntilResend over time", async () => {
			vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({
				data: { success: true },
				error: null,
			});

			const { result } = renderHook(() =>
				useEmailVerification({ email: "test@example.com" }),
			);

			// Send OTP to start cooldown
			await act(async () => {
				await result.current.sendOtp();
			});

			expect(result.current.secondsUntilResend).toBe(30);
			expect(result.current.canResend).toBe(false);

			// Advance time by 10 seconds
			await act(async () => {
				vi.advanceTimersByTime(10000);
			});

			// Should have decremented by 10
			expect(result.current.secondsUntilResend).toBe(20);
			expect(result.current.canResend).toBe(false);
		});

		it("canResend becomes true after 30 seconds", async () => {
			vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({
				data: { success: true },
				error: null,
			});

			const { result } = renderHook(() =>
				useEmailVerification({ email: "test@example.com" }),
			);

			await act(async () => {
				await result.current.sendOtp();
			});

			expect(result.current.canResend).toBe(false);

			// Advance time by 30 seconds
			await act(async () => {
				vi.advanceTimersByTime(30000);
			});

			expect(result.current.secondsUntilResend).toBe(0);
			expect(result.current.canResend).toBe(true);
		});

		it("allows resending OTP after cooldown expires", async () => {
			vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({
				data: { success: true },
				error: null,
			});

			const { result } = renderHook(() =>
				useEmailVerification({ email: "test@example.com" }),
			);

			// First send
			await act(async () => {
				await result.current.sendOtp();
			});

			expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledTimes(1);

			// Try immediately - should fail
			await act(async () => {
				const success = await result.current.sendOtp();
				expect(success).toBe(false);
			});

			expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledTimes(1);

			// Advance past cooldown
			await act(async () => {
				vi.advanceTimersByTime(31000);
			});

			// Now should succeed
			await act(async () => {
				const success = await result.current.sendOtp();
				expect(success).toBe(true);
			});

			expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledTimes(2);
		});
	});

	describe("sendOtp", () => {
		it("sends OTP successfully", async () => {
			vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({
				data: { success: true },
				error: null,
			});

			const { result } = renderHook(() =>
				useEmailVerification({ email: "test@example.com" }),
			);

			await act(async () => {
				const success = await result.current.sendOtp();
				expect(success).toBe(true);
			});

			expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
				email: "test@example.com",
				type: "email-verification",
			});
			expect(result.current.hasSentOtp).toBe(true);
			expect(result.current.secondsUntilResend).toBe(30);
		});

		it("calls changeEmail first when isNewEmail is true", async () => {
			vi.mocked(authClient.changeEmail).mockResolvedValue({
				data: { success: true },
				error: null,
			});
			vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({
				data: { success: true },
				error: null,
			});

			const { result } = renderHook(() =>
				useEmailVerification({ email: "new@example.com", isNewEmail: true }),
			);

			await act(async () => {
				await result.current.sendOtp();
			});

			expect(authClient.changeEmail).toHaveBeenCalledWith({
				newEmail: "new@example.com",
			});
			expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalled();
		});

		it("handles changeEmail error", async () => {
			vi.mocked(authClient.changeEmail).mockResolvedValue({
				data: null,
				error: { message: "Email already in use" },
			});

			const { result } = renderHook(() =>
				useEmailVerification({ email: "new@example.com", isNewEmail: true }),
			);

			await act(async () => {
				const success = await result.current.sendOtp();
				expect(success).toBe(false);
			});

			expect(result.current.error).toBe("Email already in use");
			expect(authClient.emailOtp.sendVerificationOtp).not.toHaveBeenCalled();
		});

		it("handles sendVerificationOtp error", async () => {
			vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({
				data: null,
				error: { message: "Rate limited" },
			});

			const { result } = renderHook(() =>
				useEmailVerification({ email: "test@example.com" }),
			);

			await act(async () => {
				const success = await result.current.sendOtp();
				expect(success).toBe(false);
			});

			expect(result.current.error).toBe("Rate limited");
		});

		it("respects 30 second cooldown", async () => {
			vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({
				data: { success: true },
				error: null,
			});

			const { result } = renderHook(() =>
				useEmailVerification({ email: "test@example.com" }),
			);

			// First send
			await act(async () => {
				await result.current.sendOtp();
			});

			// Try to send again immediately
			await act(async () => {
				const success = await result.current.sendOtp();
				expect(success).toBe(false);
			});

			// Should only have been called once
			expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledTimes(1);
			expect(result.current.canResend).toBe(false);
		});
	});

	describe("verifyOtp", () => {
		it("verifies OTP successfully", async () => {
			vi.mocked(authClient.emailOtp.verifyEmail).mockResolvedValue({
				data: { success: true },
				error: null,
			});
			mockInvalidate.mockResolvedValue(undefined);

			const onSuccess = vi.fn();
			const { result } = renderHook(() =>
				useEmailVerification({ email: "test@example.com", onSuccess }),
			);

			// Set OTP
			act(() => {
				result.current.setOtp("123456");
			});

			await act(async () => {
				await result.current.verifyOtp();
			});

			expect(authClient.emailOtp.verifyEmail).toHaveBeenCalledWith({
				email: "test@example.com",
				otp: "123456",
			});
			expect(mockInvalidate).toHaveBeenCalled();
			expect(onSuccess).toHaveBeenCalled();
		});

		it("handles verification error", async () => {
			vi.mocked(authClient.emailOtp.verifyEmail).mockResolvedValue({
				data: null,
				error: { message: "Invalid code" },
			});

			const { result } = renderHook(() =>
				useEmailVerification({ email: "test@example.com" }),
			);

			act(() => {
				result.current.setOtp("000000");
			});

			await act(async () => {
				await result.current.verifyOtp();
			});

			expect(result.current.error).toBe("Invalid code");
		});
	});

	describe("reset", () => {
		it("resets all state", async () => {
			vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({
				data: { success: true },
				error: null,
			});

			const { result } = renderHook(() =>
				useEmailVerification({ email: "test@example.com" }),
			);

			// Modify state
			act(() => {
				result.current.setOtp("123456");
			});

			await act(async () => {
				await result.current.sendOtp();
			});

			// Reset
			act(() => {
				result.current.reset();
			});

			expect(result.current.otp).toBe("");
			expect(result.current.error).toBeNull();
			expect(result.current.isLoading).toBe(false);
			expect(result.current.hasSentOtp).toBe(false);
			expect(result.current.secondsUntilResend).toBe(0);
			expect(result.current.canResend).toBe(true);
		});
	});

	describe("setOtp", () => {
		it("updates OTP value", () => {
			const { result } = renderHook(() =>
				useEmailVerification({ email: "test@example.com" }),
			);

			act(() => {
				result.current.setOtp("123");
			});

			expect(result.current.otp).toBe("123");

			act(() => {
				result.current.setOtp("123456");
			});

			expect(result.current.otp).toBe("123456");
		});
	});

	describe("error handling", () => {
		it("uses default error message when no message provided", async () => {
			vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({
				data: null,
				error: {},
			});

			const { result } = renderHook(() =>
				useEmailVerification({ email: "test@example.com" }),
			);

			await act(async () => {
				await result.current.sendOtp();
			});

			expect(result.current.error).toBe("Failed to send verification code");
		});

		it("handles exception thrown during sendOtp", async () => {
			vi.mocked(authClient.emailOtp.sendVerificationOtp).mockRejectedValue(
				new Error("Network error"),
			);

			const { result } = renderHook(() =>
				useEmailVerification({ email: "test@example.com" }),
			);

			await act(async () => {
				const success = await result.current.sendOtp();
				expect(success).toBe(false);
			});

			expect(result.current.error).toBe("Network error");
		});

		it("handles non-Error exception during sendOtp", async () => {
			vi.mocked(authClient.emailOtp.sendVerificationOtp).mockRejectedValue(
				"string error",
			);

			const { result } = renderHook(() =>
				useEmailVerification({ email: "test@example.com" }),
			);

			await act(async () => {
				await result.current.sendOtp();
			});

			expect(result.current.error).toBe("Failed to send verification code");
		});
	});
});
