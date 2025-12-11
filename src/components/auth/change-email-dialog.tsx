import { CheckCircle, Loader2, Mail, Pencil } from "lucide-react";
import { useState } from "react";
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
import { authClient } from "@/lib/auth-client";

/**
 * Dialog for changing email address when user already has a verified email.
 * Uses email link verification flow (not OTP) as required by better-auth.
 */
export function ChangeEmailDialog() {
	const [open, setOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [emailSent, setEmailSent] = useState(false);

	const handleClose = () => {
		setOpen(false);
		setEmail("");
		setError(null);
		setEmailSent(false);
	};

	const handleOpenChange = (isOpen: boolean) => {
		if (isOpen) {
			setOpen(true);
		} else {
			handleClose();
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsLoading(true);

		try {
			// changeEmail sends a verification link to the new email address
			// The user must click the link to verify and complete the email change
			const result = await authClient.changeEmail({
				newEmail: email,
				callbackURL: "/settings",
			});

			if (result.error) {
				throw new Error(result.error.message || "Failed to send verification email");
			}

			setEmailSent(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to send verification email");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
				>
					<Pencil className="mr-2 h-4 w-4" />
					Change Email
				</Button>
			</DialogTrigger>
			<DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
				<DialogHeader>
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500">
						{emailSent ? (
							<CheckCircle className="h-6 w-6 text-white" />
						) : (
							<Mail className="h-6 w-6 text-white" />
						)}
					</div>
					<DialogTitle className="text-center text-zinc-100">
						{emailSent ? "Check Your Email" : "Change Email Address"}
					</DialogTitle>
					<DialogDescription className="text-center text-zinc-400">
						{emailSent
							? `We've sent a verification link to ${email}. Click the link in the email to confirm your new address.`
							: "Enter your new email address. We'll send a verification link to confirm."}
					</DialogDescription>
				</DialogHeader>

				{emailSent ? (
					<div className="space-y-4 py-4">
						<div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
							<p className="text-sm text-zinc-300">
								<strong>Next steps:</strong>
							</p>
							<ol className="mt-2 list-decimal list-inside text-sm text-zinc-400 space-y-1">
								<li>Check your inbox at <strong className="text-zinc-300">{email}</strong></li>
								<li>Click the verification link in the email</li>
								<li>Your email will be updated automatically</li>
							</ol>
						</div>
						<p className="text-xs text-zinc-500 text-center">
							Didn't receive the email? Check your spam folder or close this dialog and try again.
						</p>
					</div>
				) : (
					<form onSubmit={handleSubmit}>
						<div className="space-y-4 py-4">
							{error && <ErrorAlert message={error} />}

							<div className="space-y-2">
								<Label htmlFor="email" className="text-zinc-300">
									New Email Address
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
									We'll send a verification link to this email
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
									"Send Verification Link"
								)}
							</Button>
						</DialogFooter>
					</form>
				)}

				{emailSent && (
					<DialogFooter>
						<Button
							type="button"
							onClick={handleClose}
							className="w-full bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
						>
							Done
						</Button>
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	);
}
