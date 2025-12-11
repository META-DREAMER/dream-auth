import { Loader2, Mail, Plus } from "lucide-react";
import { useState } from "react";
import { EmailOTPInput } from "@/components/auth/email-otp-input";
import { ErrorAlert } from "@/components/shared/error-alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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
				<Button
					variant="outline"
					size="sm"
					className="border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
				>
					<Plus className="mr-2 h-4 w-4" />
					Link Email
				</Button>
			</DialogTrigger>
			<DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
				<DialogHeader>
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500">
						<Mail className="h-6 w-6 text-white" />
					</div>
					<DialogTitle className="text-center text-zinc-100">
						{step === "email" ? "Link Email Address" : "Verify Your Email"}
					</DialogTitle>
					<DialogDescription className="text-center text-zinc-400">
						{step === "email"
							? "Add an email address to your account for easier recovery and notifications."
							: isLoading && !hasSentOtp
								? `Sending verification code to ${email}...`
								: `We sent a 6-digit code to ${email}. Enter it below to verify.`}
					</DialogDescription>
				</DialogHeader>

				{step === "email" ? (
					<form onSubmit={handleEmailSubmit}>
						<div className="space-y-4 py-4">
							{error && <ErrorAlert message={error} />}

							<div className="space-y-2">
								<Label htmlFor="email" className="text-zinc-300">
									Email Address
								</Label>
								<Input
									id="email"
									type="email"
									placeholder="you@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									autoComplete="email"
									className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500"
								/>
								<p className="text-xs text-zinc-500">
									We'll send a verification code to this email
								</p>
							</div>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={handleClose}
								className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={isLoading || !email}
								className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
							>
								{isLoading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

						<DialogFooter className="flex-col sm:flex-row gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={handleBackToEmail}
								className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
							>
								Back
							</Button>
							<Button
								type="submit"
								disabled={isLoading || otp.length !== 6}
								className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
							>
								{isLoading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
