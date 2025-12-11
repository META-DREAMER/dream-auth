import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
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
import { useEmailVerification } from "@/hooks/use-email-verification";

interface VerifyEmailDialogProps {
	email: string;
}

/**
 * Dialog for verifying an existing unverified email.
 * Automatically sends OTP when opened and shows the verification input.
 */
export function VerifyEmailDialog({ email }: VerifyEmailDialogProps) {
	const [open, setOpen] = useState(false);

	const handleClose = () => {
		setOpen(false);
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
		onSuccess: handleClose,
	});

	// Automatically send OTP when dialog opens
	useEffect(() => {
		if (open && !hasSentOtp && !isLoading && canResend) {
			sendOtp();
		}
	}, [open, hasSentOtp, isLoading, canResend, sendOtp]);

	const handleOpenChange = (isOpen: boolean) => {
		if (isOpen) {
			setOpen(true);
		} else {
			handleClose();
		}
	};

	const handleVerifyOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		await verifyOtp();
	};

	const handleResend = async () => {
		await sendOtp();
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
				>
					<ShieldCheck className="mr-2 h-4 w-4" />
					Verify
				</Button>
			</DialogTrigger>
			<DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
				<DialogHeader>
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500">
						<Mail className="h-6 w-6 text-white" />
					</div>
					<DialogTitle className="text-center text-zinc-100">
						Verify Your Email
					</DialogTitle>
					<DialogDescription className="text-center text-zinc-400">
						{isLoading && !hasSentOtp
							? `Sending verification code to ${email}...`
							: `We sent a 6-digit code to ${email}. Enter it below to verify.`}
					</DialogDescription>
				</DialogHeader>

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
			</DialogContent>
		</Dialog>
	);
}
