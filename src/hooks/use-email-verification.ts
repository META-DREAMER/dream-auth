import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

const OTP_COOLDOWN_SECONDS = 30;

interface UseEmailVerificationOptions {
	email: string;
	/**
	 * When true, calls changeEmail before sending OTP.
	 * Used for linking a new email to an account that doesn't have a verified email yet.
	 */
	isNewEmail?: boolean;
	onSuccess?: () => void;
}

interface UseEmailVerificationReturn {
	otp: string;
	setOtp: (otp: string) => void;
	error: string | null;
	isLoading: boolean;
	/** Whether OTP has been successfully sent */
	hasSentOtp: boolean;
	/** Whether enough time has passed to resend OTP */
	canResend: boolean;
	/** Seconds remaining until OTP can be resent (0 if can resend) */
	secondsUntilResend: number;
	/** Sends OTP to email. Returns true on success, false on error or cooldown. */
	sendOtp: () => Promise<boolean>;
	verifyOtp: () => Promise<void>;
	reset: () => void;
}

/**
 * Hook for handling email verification with OTP.
 * Used for verifying an existing email address on the account,
 * or for linking a new email (when isNewEmail is true).
 */
export function useEmailVerification({
	email,
	isNewEmail = false,
	onSuccess,
}: UseEmailVerificationOptions): UseEmailVerificationReturn {
	const router = useRouter();
	const [otp, setOtp] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [hasSentOtp, setHasSentOtp] = useState(false);
	const [secondsUntilResend, setSecondsUntilResend] = useState(0);

	const lastSentAtRef = useRef<number | null>(null);

	// Update countdown timer
	useEffect(() => {
		if (!lastSentAtRef.current) return;

		const updateCountdown = () => {
			const elapsed = Math.floor((Date.now() - lastSentAtRef.current!) / 1000);
			const remaining = Math.max(0, OTP_COOLDOWN_SECONDS - elapsed);
			setSecondsUntilResend(remaining);

			if (remaining === 0) {
				lastSentAtRef.current = null;
			}
		};

		updateCountdown();
		const interval = setInterval(updateCountdown, 1000);

		return () => clearInterval(interval);
	}, [hasSentOtp]);

	const canResend = secondsUntilResend === 0;

	const sendOtp = useCallback(async (): Promise<boolean> => {
		// Prevent sending if on cooldown
		if (lastSentAtRef.current) {
			const elapsed = Math.floor((Date.now() - lastSentAtRef.current) / 1000);
			if (elapsed < OTP_COOLDOWN_SECONDS) {
				return false;
			}
		}

		setError(null);
		setIsLoading(true);

		try {
			// If linking a new email, first call changeEmail to update the email address
			if (isNewEmail) {
				const changeResult = await authClient.changeEmail({
					newEmail: email,
				});

				if (changeResult.error) {
					throw new Error(
						changeResult.error.message || "Failed to update email address",
					);
				}
			}

			// Send OTP verification code
			const result = await authClient.emailOtp.sendVerificationOtp({
				email,
				type: "email-verification",
			});

			if (result.error) {
				throw new Error(
					result.error.message || "Failed to send verification code",
				);
			}

			lastSentAtRef.current = Date.now();
			setSecondsUntilResend(OTP_COOLDOWN_SECONDS);
			setHasSentOtp(true);
			return true;
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to send verification code",
			);
			return false;
		} finally {
			setIsLoading(false);
		}
	}, [email, isNewEmail]);

	const verifyOtp = useCallback(async () => {
		setError(null);
		setIsLoading(true);

		try {
			const result = await authClient.emailOtp.verifyEmail({
				email,
				otp,
			});

			if (result.error) {
				throw new Error(result.error.message || "Invalid verification code");
			}

			// Success - refresh session by invalidating router loaders
			await router.invalidate();
			onSuccess?.();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Invalid verification code");
		} finally {
			setIsLoading(false);
		}
	}, [email, otp, router, onSuccess]);

	const reset = useCallback(() => {
		setOtp("");
		setError(null);
		setIsLoading(false);
		setHasSentOtp(false);
		setSecondsUntilResend(0);
		lastSentAtRef.current = null;
	}, []);

	return {
		otp,
		setOtp,
		error,
		isLoading,
		hasSentOtp,
		canResend,
		secondsUntilResend,
		sendOtp,
		verifyOtp,
		reset,
	};
}
