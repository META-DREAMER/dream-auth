import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { AlertCircle, Fingerprint, KeyRound, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { signIn } from "@/lib/auth-client";

const searchSchema = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
	validateSearch: searchSchema,
	beforeLoad: async ({ context, search }) => {
		// Redirect authenticated users away from login page
		if (context.session) {
			throw redirect({ to: search.redirect || "/" });
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const { redirect: redirectParam } = Route.useSearch();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
	const [passkeySupported, setPasskeySupported] = useState(false);

	// Use ref to capture redirect value for autofill callback without re-running effect
	const redirectRef = useRef(redirectParam);
	redirectRef.current = redirectParam;

	// Check passkey support and enable conditional UI (autofill) - runs once on mount
	useEffect(() => {
		const checkPasskeySupport = async () => {
			// Check if WebAuthn is available
			if (
				typeof window !== "undefined" &&
				window.PublicKeyCredential &&
				typeof PublicKeyCredential.isConditionalMediationAvailable ===
					"function"
			) {
				try {
					const isAvailable =
						await PublicKeyCredential.isConditionalMediationAvailable();
					setPasskeySupported(isAvailable);

					// Enable conditional UI (passkey autofill)
					if (isAvailable) {
						signIn
							.passkey({
								autoFill: true,
								fetchOptions: {
									onSuccess() {
										window.location.href = redirectRef.current || "/";
									},
								},
							})
							.catch(() => {
								// Silently ignore errors from conditional UI
								// This can fail if user cancels or doesn't select a passkey
							});
					}
				} catch {
					setPasskeySupported(false);
				}
			}
		};

		checkPasskeySupport();
	}, []);

	const handlePasskeySignIn = async () => {
		setError(null);
		setIsPasskeyLoading(true);

		try {
			const result = await signIn.passkey({
				fetchOptions: {
					onSuccess() {
						navigate({ to: redirectParam || "/" });
					},
					onError(ctx) {
						setError(ctx.error.message || "Passkey authentication failed");
					},
				},
			});

			if (result?.error) {
				setError(result.error.message || "Passkey authentication failed");
				return;
			}
		} catch {
			setError("Passkey authentication failed. Please try again.");
		} finally {
			setIsPasskeyLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsLoading(true);

		try {
			const result = await signIn.email({
				email,
				password,
			});

			if (result.error) {
				setError(result.error.message || "Invalid credentials");
				return;
			}

			// Redirect to the original destination or home
			navigate({ to: redirectParam || "/" });
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
			{/* Background decoration */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
				<div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
			</div>

			<Card className="w-full max-w-md relative bg-zinc-900/80 backdrop-blur-sm border-zinc-800">
				<CardHeader className="space-y-1 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500">
						<KeyRound className="h-6 w-6 text-white" />
					</div>
					<CardTitle className="text-2xl font-bold tracking-tight text-zinc-100">
						Welcome back
					</CardTitle>
					<CardDescription className="text-zinc-400">
						Sign in to your account to continue
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					{error && (
						<div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
							<AlertCircle className="h-4 w-4 shrink-0" />
							<span>{error}</span>
						</div>
					)}

					{/* Passkey Sign In Button */}
					{passkeySupported && (
						<Button
							type="button"
							onClick={handlePasskeySignIn}
							disabled={isPasskeyLoading}
							variant="outline"
							className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-50 hover:border-emerald-500/50"
						>
							{isPasskeyLoading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Authenticating...
								</>
							) : (
								<>
									<Fingerprint className="mr-2 h-4 w-4" />
									Sign in with Passkey
								</>
							)}
						</Button>
					)}

					{/* Wallet Connect Button */}
					<WalletConnectButton
						onSuccess={() => navigate({ to: redirectParam || "/" })}
						onError={(err) => setError(err)}
					/>

				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<Separator className="w-full bg-zinc-800" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-zinc-900 px-2 text-zinc-500">
							or continue with email
						</span>
					</div>
				</div>

					{/* Email/Password Form */}
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="email" className="text-zinc-300">
								Email
							</Label>
							<Input
								id="email"
								type="email"
								placeholder="you@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								autoComplete="username webauthn"
								className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="password" className="text-zinc-300">
								Password
							</Label>
							<Input
								id="password"
								type="password"
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								autoComplete="current-password webauthn"
								className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500"
							/>
						</div>

						<Button
							type="submit"
							disabled={isLoading}
							className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-medium"
						>
							{isLoading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Signing in...
								</>
							) : (
								"Sign in"
							)}
						</Button>
					</form>
				</CardContent>

				<CardFooter className="flex flex-col">
					<p className="text-center text-sm text-zinc-500">
						Don't have an account?{" "}
						<Link
							to="/register"
							search={{ redirect: redirectParam }}
							className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
						>
							Create one
						</Link>
					</p>
				</CardFooter>
			</Card>
		</div>
	);
}
