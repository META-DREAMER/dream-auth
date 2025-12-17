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
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
				<PageBackground />
				{/* Extra center decoration for unauthenticated view */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

				<div className="relative text-center max-w-xl">
					<div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/25">
						<Shield className="h-10 w-10 text-white" />
					</div>

					<h1 className="text-4xl font-bold tracking-tight text-zinc-100 mb-4">
						Auth Server
					</h1>
					<p className="text-lg text-zinc-400 mb-8">
						Home Cluster Identity Provider
					</p>

					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						<Button
							asChild
							size="lg"
							className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-medium"
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
							className="border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
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
		<div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
			<PageBackground />

			<div className="relative max-w-2xl mx-auto pt-20">
				<Card className="bg-zinc-900/80 backdrop-blur-sm border-zinc-800">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500">
							<User className="h-8 w-8 text-white" />
						</div>
						<CardTitle className="text-2xl text-zinc-100">
							Welcome back, {session.user.name || "User"}
						</CardTitle>
						<CardDescription className="text-zinc-400">
							You are signed in as {session.user.email}
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-6">
						<div className="rounded-lg bg-zinc-800/50 border border-zinc-700 p-4">
							<h3 className="text-sm font-medium text-zinc-400 mb-3">
								Session Info
							</h3>
							<dl className="space-y-2 text-sm">
								<div className="flex justify-between">
									<dt className="text-zinc-500">User ID</dt>
									<dd className="text-zinc-300 font-mono text-xs">
										{session.user.id}
									</dd>
								</div>
								<div className="flex justify-between">
									<dt className="text-zinc-500">Email</dt>
									<dd className="text-zinc-300">{session.user.email}</dd>
								</div>
								{session.user.name && (
									<div className="flex justify-between">
										<dt className="text-zinc-500">Name</dt>
										<dd className="text-zinc-300">{session.user.name}</dd>
									</div>
								)}
							</dl>
						</div>

						<div className="flex flex-col sm:flex-row gap-3">
							<Button
								asChild
								className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-medium"
							>
								<Link to="/org">
									<Building2 className="mr-2 h-4 w-4" />
									Organizations
								</Link>
							</Button>
							<Button
								asChild
								variant="outline"
								className="flex-1 border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
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
							className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400"
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
