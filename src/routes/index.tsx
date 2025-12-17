import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, KeyRound, LogOut, Settings, Shield, User } from "lucide-react";
import { PageBackground } from "@/components/shared/page-background";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useSignOut } from "@/hooks/use-sign-out";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	const { session } = Route.useRouteContext();
	const handleSignOut = useSignOut();

	// Not authenticated - show welcome page with login prompt
	if (!session) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background p-4">
				<PageBackground />
				{/* Extra center decoration for unauthenticated view */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

				<div className="relative text-center max-w-xl">
					<div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
						<Shield className="h-10 w-10 text-primary-foreground" />
					</div>

					<h1 className="text-4xl font-bold tracking-tight mb-4">
						Auth Server
					</h1>
					<p className="text-lg text-muted-foreground mb-8">
						Home Cluster Identity Provider
					</p>

					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						<Button
							asChild
							size="lg"
							className="w-full"
						>
							<Link to="/login">
								<KeyRound className="mr-2 h-5 w-5" />
								Sign in
							</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							size="lg"
							className="w-full"
						>
							<Link to="/register">Create account</Link>
						</Button>
					</div>
				</div>
			</div>
		);
	}

	// Authenticated - show user info
	return (
		<div className="min-h-screen bg-background p-4">
			<PageBackground />

			<div className="relative max-w-2xl mx-auto pt-20">
				<Card>
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
							<User className="h-8 w-8 text-primary-foreground" />
						</div>
						<CardTitle className="text-2xl">
							Welcome back, {session.user.name || "User"}
						</CardTitle>
						<CardDescription>
							You are signed in as {session.user.email}
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-6">
						<div className="rounded-lg bg-muted/50 border p-4">
							<h3 className="text-sm font-medium text-muted-foreground mb-3">
								Session Info
							</h3>
							<dl className="space-y-2 text-sm">
								<div className="flex justify-between">
									<dt className="text-muted-foreground">User ID</dt>
									<dd className="font-mono text-xs">
										{session.user.id}
									</dd>
								</div>
								<div className="flex justify-between">
									<dt className="text-muted-foreground">Email</dt>
									<dd>{session.user.email}</dd>
								</div>
								{session.user.name && (
									<div className="flex justify-between">
										<dt className="text-muted-foreground">Name</dt>
										<dd>{session.user.name}</dd>
									</div>
								)}
							</dl>
						</div>

						<div className="flex flex-col sm:flex-row gap-3">
							<Button
								asChild
								className="flex-1"
							>
								<Link to="/org">
									<Building2 className="mr-2 h-4 w-4" />
									Organizations
								</Link>
							</Button>
							<Button
								asChild
								variant="outline"
								className="flex-1"
							>
								<Link to="/settings">
									<Settings className="mr-2 h-4 w-4" />
									Settings
								</Link>
							</Button>
						</div>
						<Button
							onClick={handleSignOut}
							variant="outline"
							className="w-full hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive-foreground"
						>
							<LogOut className="mr-2 h-4 w-4" />
							Sign out
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
