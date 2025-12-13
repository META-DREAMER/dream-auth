import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Check, KeyRound, Loader2, Shield, X } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { ErrorAlert } from "@/components/shared/error-alert";
import { PageBackground } from "@/components/shared/page-background";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { oauth2 } from "@/lib/auth-client";

const searchSchema = z.object({
	consent_code: z.string().optional(),
	client_id: z.string().optional(),
	scope: z.string().optional(),
});

/**
 * Human-readable descriptions for OAuth scopes
 */
const SCOPE_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
	openid: {
		label: "OpenID",
		description: "Verify your identity",
	},
	profile: {
		label: "Profile",
		description: "View your profile information (name, avatar)",
	},
	email: {
		label: "Email",
		description: "View your email address",
	},
	offline_access: {
		label: "Offline Access",
		description: "Maintain access when you're not using the application",
	},
};

export const Route = createFileRoute("/consent")({
	validateSearch: searchSchema,
	ssr: false,
	beforeLoad: async ({ context, location }) => {
		// Require authentication for consent page
		if (!context.session) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}
		return { session: context.session };
	},
	component: ConsentPage,
});

function ConsentPage() {
	const navigate = useNavigate();
	const { consent_code, client_id, scope } = Route.useSearch();
	const { session } = Route.useRouteContext();

	const [isLoading, setIsLoading] = useState(false);
	const [isDenying, setIsDenying] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Parse scopes from space-separated string
	const scopes = scope?.split(" ").filter(Boolean) || [];

	// Handle missing required parameters
	if (!consent_code || !client_id) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
				<PageBackground />
				<Card className="w-full max-w-md relative bg-zinc-900/80 backdrop-blur-sm border-zinc-800">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
							<X className="h-6 w-6 text-red-400" />
						</div>
						<CardTitle className="text-xl text-zinc-100">
							Invalid Authorization Request
						</CardTitle>
						<CardDescription className="text-zinc-400">
							Missing required parameters. Please try the authorization flow again.
						</CardDescription>
					</CardHeader>
					<CardFooter className="justify-center">
						<Button
							onClick={() => navigate({ to: "/" })}
							variant="outline"
							className="border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800"
						>
							Go Home
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	const handleConsent = async (accept: boolean) => {
		setError(null);
		if (accept) {
			setIsLoading(true);
		} else {
			setIsDenying(true);
		}

		try {
			const result = await oauth2.consent({
				accept,
				consent_code,
			});

			if (result.error) {
				setError(result.error.message || "Failed to process authorization");
				return;
			}

			// Redirect to the URL provided by the OIDC provider
			if (result.data?.redirectURI) {
				window.location.href = result.data.redirectURI;
			} else {
				// Fallback: navigate home if no redirect URL
				navigate({ to: "/" });
			}
		} catch (err) {
			console.error("Consent error:", err);
			setError("An unexpected error occurred. Please try again.");
		} finally {
			setIsLoading(false);
			setIsDenying(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
			<PageBackground />

			<Card className="w-full max-w-md relative bg-zinc-900/80 backdrop-blur-sm border-zinc-800">
				<CardHeader className="space-y-1 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500">
						<Shield className="h-6 w-6 text-white" />
					</div>
					<CardTitle className="text-xl font-bold tracking-tight text-zinc-100">
						Authorization Request
					</CardTitle>
					<CardDescription className="text-zinc-400">
						<span className="font-medium text-zinc-200">{client_id}</span> wants
						to access your account
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					{error && <ErrorAlert message={error} />}

					{/* User info */}
					<div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
							<span className="text-lg font-semibold text-emerald-400">
								{session.user.name?.charAt(0).toUpperCase() ||
									session.user.email?.charAt(0).toUpperCase() ||
									"U"}
							</span>
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium text-zinc-100 truncate">
								{session.user.name || "User"}
							</p>
							{session.user.email && (
								<p className="text-xs text-zinc-400 truncate">
									{session.user.email}
								</p>
							)}
						</div>
						<Badge
							variant="outline"
							className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
						>
							<KeyRound className="h-3 w-3 mr-1" />
							You
						</Badge>
					</div>

					<Separator className="bg-zinc-800" />

					{/* Requested permissions */}
					<div className="space-y-3">
						<h3 className="text-sm font-medium text-zinc-300">
							This application is requesting access to:
						</h3>
						<ul className="space-y-2">
							{scopes.map((scopeKey) => {
								const scopeInfo = SCOPE_DESCRIPTIONS[scopeKey] || {
									label: scopeKey,
									description: `Access to ${scopeKey}`,
								};
								return (
									<li
										key={scopeKey}
										className="flex items-start gap-3 p-2 rounded-md bg-zinc-800/30"
									>
										<div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 mt-0.5">
											<Check className="h-3 w-3 text-emerald-400" />
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-zinc-200">
												{scopeInfo.label}
											</p>
											<p className="text-xs text-zinc-400">
												{scopeInfo.description}
											</p>
										</div>
									</li>
								);
							})}
							{scopes.length === 0 && (
								<li className="text-sm text-zinc-400 italic">
									No specific permissions requested
								</li>
							)}
						</ul>
					</div>

					<Separator className="bg-zinc-800" />

					{/* Security notice */}
					<p className="text-xs text-zinc-500 text-center">
						By authorizing, you allow this application to access your account
						information. You can revoke access at any time from your settings.
					</p>
				</CardContent>

				<CardFooter className="flex gap-3">
					<Button
						onClick={() => handleConsent(false)}
						disabled={isLoading || isDenying}
						variant="outline"
						className="flex-1 border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400"
					>
						{isDenying ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Denying...
							</>
						) : (
							<>
								<X className="mr-2 h-4 w-4" />
								Deny
							</>
						)}
					</Button>
					<Button
						onClick={() => handleConsent(true)}
						disabled={isLoading || isDenying}
						className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-medium"
					>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Authorizing...
							</>
						) : (
							<>
								<Check className="mr-2 h-4 w-4" />
								Authorize
							</>
						)}
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
