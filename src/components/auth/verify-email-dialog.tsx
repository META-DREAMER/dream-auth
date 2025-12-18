import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { EmailOTPInput } from "@/components/auth/email-otp-input";
import { ErrorAlert } from "@/components/shared/error-alert";
import { DialogHeaderScaffold } from "@/components/shared/dialog-scaffold";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
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
					className="border-warning/30 bg-warning/10 text-warning-foreground hover:bg-warning/20 hover:text-warning-foreground"
				>
					<ShieldCheck className="mr-2 h-4 w-4" />
					Verify
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeaderScaffold
					icon={Mail}
					title="Verify Your Email"
					description={
						isLoading && !hasSentOtp
							? `Sending verification code to ${email}...`
							: `We sent a 6-digit code to ${email}. Enter it below to verify.`
					}
				/>

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
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							type="submit"
							disabled={isLoading || otp.length !== 6}
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
