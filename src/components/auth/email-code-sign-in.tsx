import { SpinnerIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useState } from "react";
import { EmailOTPInput } from "@/components/auth/email-otp-input";
import { ErrorAlert } from "@/components/shared/error-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailOtp, signIn } from "@/lib/auth-client";

const RESEND_COOLDOWN_SECONDS = 30;

interface EmailCodeSignInProps {
	/**
	 * Runs once the code is accepted and the session exists, and is awaited
	 * before the sign-in finishes. Awaiting matters when `/login` was reached
	 * from an app's OAuth redirect: the response is then the provider's
	 * `{ redirect, url }` continuation, which better-auth's redirect fetch
	 * plugin follows only after this returns. So a prompt shown here (the
	 * passkey offer) still runs before the user is sent back to the app.
	 */
	onSignedIn: (data: unknown, email: string) => Promise<void>;
	/** Name for a brand-new account. An existing user's name is untouched. */
	name?: string;
	/** Extra fields on the first step, above the email (e.g. a name). */
	children?: ReactNode;
	emailAutoComplete?: string;
	/**
	 * The address is already known (an email invitation): shown read-only and
	 * never editable, so "Use a different email" goes too.
	 */
	fixedEmail?: string;
	/** Under the read-only email, and under the code: what to do if it's wrong. */
	wrongEmailHint?: ReactNode;
	/** Label of the button that sends the code. */
	sendLabel?: string;
}

/**
 * Passwordless sign-in and sign-up: email address, then a six-digit code.
 *
 * A code sign-in for an address with no account creates one (email already
 * verified) when the server's invite gate allows it. The page URL is never
 * touched between the two steps: on `/login` it carries the signed OAuth
 * query that every sign-in request must echo back.
 */
export function EmailCodeSignIn({
	onSignedIn,
	name,
	children,
	emailAutoComplete = "email",
	fixedEmail,
	wrongEmailHint,
	sendLabel = "Email me a code",
}: EmailCodeSignInProps) {
	const [typedEmail, setEmail] = useState("");
	const email = fixedEmail ?? typedEmail;
	const [otp, setOtp] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [secondsUntilResend, setSecondsUntilResend] = useState(0);

	useEffect(() => {
		if (secondsUntilResend <= 0) return;
		const timer = setTimeout(() => setSecondsUntilResend((s) => s - 1), 1000);
		return () => clearTimeout(timer);
	}, [secondsUntilResend]);

	const sendCode = async () => {
		setError(null);
		setIsLoading(true);
		try {
			const result = await emailOtp.sendVerificationOtp({
				email,
				type: "sign-in",
			});
			if (result.error) {
				setError(result.error.message || "Could not send a code");
				return;
			}
			setCodeSent(true);
			setOtp("");
			setSecondsUntilResend(RESEND_COOLDOWN_SECONDS);
		} catch {
			setError("Could not send a code. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const verifyCode = async () => {
		setError(null);
		setIsLoading(true);
		try {
			const result = await signIn.emailOtp({
				email,
				otp,
				...(name && { name }),
				fetchOptions: {
					onSuccess: (ctx: { data: unknown }) => onSignedIn(ctx.data, email),
				},
			});
			if (result.error) {
				setError(result.error.message || "That code did not work");
			}
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	if (!codeSent) {
		return (
			<form
				onSubmit={(e) => {
					e.preventDefault();
					sendCode();
				}}
				className="space-y-4"
			>
				{error && <ErrorAlert message={error} />}
				{children}
				<div className="space-y-2">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						type="email"
						placeholder="you@example.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						readOnly={fixedEmail !== undefined}
						aria-readonly={fixedEmail !== undefined}
						className={fixedEmail !== undefined ? "bg-muted" : undefined}
						autoComplete={emailAutoComplete}
					/>
					{wrongEmailHint && (
						<p className="text-xs text-muted-foreground">{wrongEmailHint}</p>
					)}
				</div>
				<Button type="submit" disabled={isLoading} className="w-full">
					{isLoading ? (
						<>
							<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
							Sending code...
						</>
					) : (
						sendLabel
					)}
				</Button>
			</form>
		);
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				verifyCode();
			}}
			className="space-y-4"
		>
			{error && <ErrorAlert message={error} />}
			<p className="text-sm text-muted-foreground text-center">
				{fixedEmail === undefined ? (
					<>
						If <span className="font-medium text-foreground">{email}</span> can
						sign in here, a 6-digit code is on its way.
					</>
				) : (
					<>
						We sent a 6-digit code to{" "}
						<span className="font-medium text-foreground">{email}</span>.
					</>
				)}{" "}
				It expires in 5 minutes.
			</p>
			<EmailOTPInput
				value={otp}
				onChange={setOtp}
				onResend={sendCode}
				canResend={secondsUntilResend <= 0 && !isLoading}
				secondsUntilResend={secondsUntilResend}
			/>
			<Button
				type="submit"
				disabled={isLoading || otp.length !== 6}
				className="w-full"
			>
				{isLoading ? (
					<>
						<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
						Verifying...
					</>
				) : (
					"Continue"
				)}
			</Button>
			{fixedEmail === undefined ? (
				<Button
					type="button"
					variant="link"
					className="w-full"
					onClick={() => {
						setCodeSent(false);
						setOtp("");
						setError(null);
					}}
				>
					Use a different email
				</Button>
			) : (
				wrongEmailHint && (
					<p className="text-xs text-muted-foreground text-center">
						{wrongEmailHint}
					</p>
				)
			)}
		</form>
	);
}
