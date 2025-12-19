import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { CheckCircleIcon, SpinnerIcon, UserPlusIcon } from "@phosphor-icons/react";
import { useState } from "react";
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
import { signUp } from "@/lib/auth-client";

const searchSchema = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute("/register")({
	validateSearch: searchSchema,
	beforeLoad: async ({ context, search }) => {
		if (context.session) {
			throw redirect({ to: search.redirect || "/" });
		}
	},
	component: RegisterPage,
});

function RegisterPage() {
	const navigate = useNavigate();
	const { redirect: redirectTo } = Route.useSearch();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsLoading(true);

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			setIsLoading(false);
			return;
		}

		if (password.length < 8) {
			setError("Password must be at least 8 characters");
			setIsLoading(false);
			return;
		}

		try {
			const result = await signUp.email({ email, password, name });

			if (result.error) {
				setError(result.error.message || "Registration failed");
				return;
			}

			setSuccess(true);
			setTimeout(() => {
				navigate({ to: redirectTo || "/" });
			}, 1500);
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	if (success) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<Card className="w-full max-w-md">
					<CardContent className="pt-6 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/20">
						<CheckCircleIcon className="h-6 w-6 text-success" />
					</div>
						<h2 className="text-xl font-semibold mb-2">
							Account created!
						</h2>
						<p className="text-muted-foreground">Redirecting you now...</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<PageBackground />

			<Card className="w-full max-w-md relative">
				<CardHeader className="space-y-1 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
						<UserPlusIcon className="h-6 w-6 text-primary-foreground" />
					</div>
					<CardTitle className="text-2xl font-bold tracking-tight">
						Create an account
					</CardTitle>
					<CardDescription>
						Enter your details to get started
					</CardDescription>
				</CardHeader>

				<form onSubmit={handleSubmit}>
					<CardContent className="space-y-4">
						{error && <ErrorAlert message={error} />}

					<ConnectSIWEButton
						onSuccess={() => {
							setSuccess(true);
							setTimeout(() => {
								navigate({ to: redirectTo || "/" });
							}, 1500);
						}}
						onError={(err) => setError(err)}
					/>

						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<Separator className="w-full" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-background px-2 text-muted-foreground">
									or register with email
								</span>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="name">
								Name
							</Label>
							<Input
								id="name"
								type="text"
								placeholder="John Doe"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								autoComplete="name"
							/>
						</div>

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
								autoComplete="email"
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
								autoComplete="new-password"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="confirmPassword">
								Confirm Password
							</Label>
							<Input
								id="confirmPassword"
								type="password"
								placeholder="••••••••"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
								autoComplete="new-password"
							/>
						</div>
					</CardContent>

					<CardFooter className="flex flex-col gap-4">
						<Button
							type="submit"
							disabled={isLoading}
							className="w-full"
						>
							{isLoading ? (
								<>
									<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
									Creating account...
								</>
							) : (
								"Create account"
							)}
						</Button>

						<p className="text-center text-sm text-muted-foreground">
						Already have an account?{" "}
						<Link
							to="/login"
							search={{ redirect: redirectTo }}
							className="text-primary hover:text-primary/80 font-medium transition-colors"
						>
							Sign in
						</Link>
						</p>
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}
