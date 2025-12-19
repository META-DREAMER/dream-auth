import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { CheckIcon, KeyIcon, SpinnerIcon, ShieldIcon, XIcon } from "@phosphor-icons/react";
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
			<div className="min-h-screen flex items-center justify-center p-4">
				<PageBackground />
				<Card className="w-full max-w-md relative">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
							<XIcon className="h-6 w-6 text-red-400" />
						</div>
						<CardTitle className="text-xl">
							Invalid Authorization Request
						</CardTitle>
						<CardDescription>
							Missing required parameters. Please try the authorization flow again.
						</CardDescription>
					</CardHeader>
					<CardFooter className="justify-center">
						<Button
							onClick={() => navigate({ to: "/" })}
							variant="outline"
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
		<div className="min-h-screen flex items-center justify-center p-4">
			<PageBackground />

			<Card className="w-full max-w-md relative">
				<CardHeader className="space-y-1 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
						<ShieldIcon className="h-6 w-6 text-primary-foreground" />
					</div>
					<CardTitle className="text-xl font-bold tracking-tight">
						Authorization Request
					</CardTitle>
					<CardDescription>
						<span className="font-medium">{client_id}</span> wants
						to access your account
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					{error && <ErrorAlert message={error} />}

					{/* User info */}
					<div className="flex items-center gap-3 p-3 rounded-lg bg-muted border">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
							<span className="text-lg font-semibold text-primary">
								{session.user.name?.charAt(0).toUpperCase() ||
									session.user.email?.charAt(0).toUpperCase() ||
									"U"}
							</span>
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium truncate">
								{session.user.name || "User"}
							</p>
							{session.user.email && (
								<p className="text-xs text-muted-foreground truncate">
									{session.user.email}
								</p>
							)}
						</div>
					<Badge
						variant="outline"
						className="border-success/30 text-success bg-success/10"
					>
						<KeyIcon className="h-3 w-3 mr-1" />
						You
					</Badge>
					</div>

					<Separator />

					{/* Requested permissions */}
					<div className="space-y-3">
						<h3 className="text-sm font-medium">
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
									className="flex items-start gap-3 p-2 rounded-md bg-muted/50"
								>
									<div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20 mt-0.5">
										<CheckIcon className="h-3 w-3 text-success" />
									</div>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium">
												{scopeInfo.label}
											</p>
											<p className="text-xs text-muted-foreground">
												{scopeInfo.description}
											</p>
										</div>
									</li>
								);
							})}
							{scopes.length === 0 && (
								<li className="text-sm text-muted-foreground italic">
									No specific permissions requested
								</li>
							)}
						</ul>
					</div>

					<Separator />

					{/* Security notice */}
					<p className="text-xs text-muted-foreground text-center">
						By authorizing, you allow this application to access your account
						information. You can revoke access at any time from your settings.
					</p>
				</CardContent>

				<CardFooter className="flex gap-3">
					<Button
						onClick={() => handleConsent(false)}
						disabled={isLoading || isDenying}
						variant="outline"
						className="flex-1 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive"
					>
						{isDenying ? (
							<>
								<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
								Denying...
							</>
						) : (
							<>
								<XIcon className="mr-2 h-4 w-4" />
								Deny
							</>
						)}
					</Button>
					<Button
						onClick={() => handleConsent(true)}
						disabled={isLoading || isDenying}
						className="flex-1 font-medium"
					>
						{isLoading ? (
							<>
								<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
								Authorizing...
							</>
						) : (
							<>
								<CheckIcon className="mr-2 h-4 w-4" />
								Authorize
							</>
						)}
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
