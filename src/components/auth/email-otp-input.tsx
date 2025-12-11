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
					className="gap-2"
				>
					<InputOTPGroup>
						<InputOTPSlot
							index={0}
							className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
						/>
						<InputOTPSlot
							index={1}
							className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
						/>
						<InputOTPSlot
							index={2}
							className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
						/>
					</InputOTPGroup>
					<InputOTPSeparator className="text-zinc-600" />
					<InputOTPGroup>
						<InputOTPSlot
							index={3}
							className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
						/>
						<InputOTPSlot
							index={4}
							className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
						/>
						<InputOTPSlot
							index={5}
							className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
						/>
					</InputOTPGroup>
				</InputOTP>
			</div>
			{onResend && (
				<p className="text-xs text-zinc-500 text-center">
					Didn't receive a code?{" "}
					{canResend ? (
						<button
							type="button"
							onClick={onResend}
							className="text-emerald-400 hover:text-emerald-300"
						>
							Try again
						</button>
					) : (
						<span className="text-zinc-400">
							Resend in {secondsUntilResend}s
						</span>
					)}
				</p>
			)}
		</div>
	);
}
