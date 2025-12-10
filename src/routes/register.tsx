import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { AlertCircle, CheckCircle, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
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
import { signUp } from "@/lib/auth-client";

const searchSchema = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute("/register")({
	validateSearch: searchSchema,
	beforeLoad: async ({ context, search }) => {
		// Redirect authenticated users away from register page
		if (context.session) {
			throw redirect({ to: search.redirect || "/" });
		}
	},
	component: RegisterPage,
});

function RegisterPage() {
	const navigate = useNavigate();
	const { redirect } = Route.useSearch();
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

		// Validate passwords match
		if (password !== confirmPassword) {
			setError("Passwords do not match");
			setIsLoading(false);
			return;
		}

		// Validate password strength
		if (password.length < 8) {
			setError("Password must be at least 8 characters");
			setIsLoading(false);
			return;
		}

		try {
			const result = await signUp.email({
				email,
				password,
				name,
			});

			if (result.error) {
				setError(result.error.message || "Registration failed");
				return;
			}

			setSuccess(true);
			// Redirect after a short delay to show success message
			setTimeout(() => {
				navigate({ to: redirect || "/" });
			}, 1500);
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	if (success) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
				<Card className="w-full max-w-md bg-zinc-900/80 backdrop-blur-sm border-zinc-800">
					<CardContent className="pt-6 text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
							<CheckCircle className="h-6 w-6 text-emerald-400" />
						</div>
						<h2 className="text-xl font-semibold text-zinc-100 mb-2">
							Account created!
						</h2>
						<p className="text-zinc-400">Redirecting you now...</p>
					</CardContent>
				</Card>
			</div>
		);
	}

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
						<UserPlus className="h-6 w-6 text-white" />
					</div>
					<CardTitle className="text-2xl font-bold tracking-tight text-zinc-100">
						Create an account
					</CardTitle>
					<CardDescription className="text-zinc-400">
						Enter your details to get started
					</CardDescription>
				</CardHeader>

				<form onSubmit={handleSubmit}>
					<CardContent className="space-y-4">
						{error && (
							<div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
								<AlertCircle className="h-4 w-4 shrink-0" />
								<span>{error}</span>
							</div>
						)}

						<div className="space-y-2">
							<Label htmlFor="name" className="text-zinc-300">
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
								className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500"
							/>
						</div>

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
								autoComplete="email"
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
								autoComplete="new-password"
								className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="confirmPassword" className="text-zinc-300">
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
								className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500"
							/>
						</div>
					</CardContent>

					<CardFooter className="flex flex-col gap-4">
						<Button
							type="submit"
							disabled={isLoading}
							className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-medium"
						>
							{isLoading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Creating account...
								</>
							) : (
								"Create account"
							)}
						</Button>

						<p className="text-center text-sm text-zinc-500">
							Already have an account?{" "}
							<Link
								to="/login"
								search={{ redirect }}
								className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
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
