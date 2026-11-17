import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@/components/ui/input-otp";

interface EmailOTPInputProps {
	value: string;
	onChange: (value: string) => void;
	onResend?: () => void;
	canResend?: boolean;
	secondsUntilResend?: number;
}

/**
 * Styled OTP input component for email verification.
 * Displays 6 digit slots with consistent styling.
 */
export function EmailOTPInput({
	value,
	onChange,
	onResend,
	canResend = true,
	secondsUntilResend = 0,
}: EmailOTPInputProps) {
	return (
		<div className="space-y-2">
			<div className="flex justify-center">
				<InputOTP
					maxLength={6}
					value={value}
					onChange={onChange}
					autoComplete="one-time-code"
					inputMode="numeric"
					pattern={REGEXP_ONLY_DIGITS}
					aria-label="6-digit code"
					className="gap-2"
				>
					<InputOTPGroup>
						<InputOTPSlot index={0} />
						<InputOTPSlot index={1} />
						<InputOTPSlot index={2} />
					</InputOTPGroup>
					<InputOTPSeparator />
					<InputOTPGroup>
						<InputOTPSlot index={3} />
						<InputOTPSlot index={4} />
						<InputOTPSlot index={5} />
					</InputOTPGroup>
				</InputOTP>
			</div>
			{onResend && (
				<p className="text-xs text-muted-foreground text-center">
					Didn't receive a code? Check your spam folder, or{" "}
					{canResend ? (
						<button
							type="button"
							onClick={onResend}
							className="text-primary hover:text-primary/80"
						>
							send a new one
						</button>
					) : (
						<span>send a new one in {secondsUntilResend}s</span>
					)}
				</p>
			)}
		</div>
	);
}
