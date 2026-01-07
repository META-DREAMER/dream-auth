import { EnvelopeIcon, PlusIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { EmailOTPInput } from "@/components/auth/email-otp-input";
import { DialogHeaderScaffold } from "@/components/shared/dialog-scaffold";
import { ErrorAlert } from "@/components/shared/error-alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEmailVerification } from "@/hooks/use-email-verification";

/**
 * Dialog for linking a new email address when user doesn't have a verified email yet.
 * Uses OTP verification flow - user enters email, receives OTP code, then verifies.
 */
export function LinkEmailDialog() {
	const [open, setOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [step, setStep] = useState<"email" | "otp">("email");

	const handleClose = () => {
		setOpen(false);
		setEmail("");
		setStep("email");
		reset();
	};

	const {
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
	} = useEmailVerification({
		email,
		isNewEmail: true,
		onSuccess: handleClose,
	});

	const handleOpenChange = (isOpen: boolean) => {
		if (isOpen) {
			setOpen(true);
		} else {
			handleClose();
		}
	};

	const handleEmailSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const success = await sendOtp();
		if (success) {
			setStep("otp");
		}
	};

	const handleVerifyOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		await verifyOtp();
	};

	const handleResend = async () => {
		await sendOtp();
	};

	const handleBackToEmail = () => {
		setStep("email");
		reset();
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<PlusIcon className="mr-2 h-4 w-4" />
					Link Email
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeaderScaffold
					icon={EnvelopeIcon}
					title={step === "email" ? "Link Email Address" : "Verify Your Email"}
					description={
						step === "email"
							? "Add an email address to your account for easier recovery and notifications."
							: isLoading && !hasSentOtp
								? `Sending verification code to ${email}...`
								: `We sent a 6-digit code to ${email}. Enter it below to verify.`
					}
				/>

				{step === "email" ? (
					<form onSubmit={handleEmailSubmit}>
						<div className="space-y-4 py-4">
							{error && <ErrorAlert message={error} />}

							<div className="space-y-2">
								<Label htmlFor="email">Email Address</Label>
								<Input
									id="email"
									type="email"
									placeholder="you@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									autoComplete="email"
								/>
								<p className="text-xs text-muted-foreground">
									We'll send a verification code to this email
								</p>
							</div>
						</div>

						<DialogFooter>
							<DialogClose asChild>
								<Button variant="outline">Cancel</Button>
							</DialogClose>
							<Button type="submit" disabled={isLoading || !email}>
								{isLoading ? (
									<>
										<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
										Sending...
									</>
								) : (
									"Send Verification Code"
								)}
							</Button>
						</DialogFooter>
					</form>
				) : (
					<form onSubmit={handleVerifyOtp}>
						<div className="space-y-4 py-4">
							{error && <ErrorAlert message={error} />}

							<EmailOTPInput
								value={otp}
								onChange={setOtp}
								onResend={handleResend}
								canResend={canResend}
								secondsUntilResend={secondsUntilResend}
							/>
						</div>

						<DialogFooter className="flex-col-reverse sm:flex-row gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={handleBackToEmail}
							>
								Back
							</Button>
							<Button type="submit" disabled={isLoading || otp.length !== 6}>
								{isLoading ? (
									<>
										<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
										Verifying...
									</>
								) : (
									"Verify Email"
								)}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
