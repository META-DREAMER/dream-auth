import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { Fingerprint, KeyRound, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ConnectSIWEButton } from "@/components/auth/connect-siwe-button";
import { ErrorAlert } from "@/components/shared/error-alert";
import { PageBackground } from "@/components/shared/page-background";
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
import { signIn } from "@/lib/auth-client";

const searchSchema = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
	validateSearch: searchSchema,
	ssr: false,
	beforeLoad: async ({ context, search }) => {
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
			// biome-ignore lint/complexity/useOptionalChain: typeof check required for SSR safety - window?.X still throws ReferenceError if window is undeclared
			if (
				typeof window !== "undefined" &&
				window.PublicKeyCredential &&
				typeof window.PublicKeyCredential.isConditionalMediationAvailable ===
					"function"
			) {
				try {
					const isAvailable =
						await window.PublicKeyCredential.isConditionalMediationAvailable();
					setPasskeySupported(isAvailable);

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
			const result = await signIn.email({ email, password });

			if (result.error) {
				setError(result.error.message || "Invalid credentials");
				return;
			}

			navigate({ to: redirectParam || "/" });
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<PageBackground />

			<Card className="w-full max-w-md relative">
				<CardHeader className="space-y-1 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
						<KeyRound className="h-6 w-6 text-primary-foreground" />
					</div>
					<CardTitle className="text-2xl font-bold tracking-tight">
						Welcome back
					</CardTitle>
					<CardDescription>
						Sign in to your account to continue
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					{error && <ErrorAlert message={error} />}

					{passkeySupported && (
						<Button
							type="button"
							onClick={handlePasskeySignIn}
							disabled={isPasskeyLoading}
							variant="outline"
							className="w-full"
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

				<ConnectSIWEButton
					onSuccess={() => navigate({ to: redirectParam || "/" })}
					onError={(err) => setError(err)}
				/>

					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<Separator className="w-full" />
						</div>
						<div className="relative flex justify-center text-xs uppercase">
							<span className="bg-background px-2 text-muted-foreground">
								or continue with email
							</span>
						</div>
					</div>

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="email">
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
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="password">
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
							/>
						</div>

						<Button
							type="submit"
							disabled={isLoading}
							className="w-full"
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
					<p className="text-center text-sm text-muted-foreground">
					Don't have an account?{" "}
					<Link
						to="/register"
						search={{ redirect: redirectParam }}
						className="text-primary hover:text-primary/80 font-medium transition-colors"
					>
						Create one
					</Link>
					</p>
				</CardFooter>
			</Card>
		</div>
	);
}
