import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Fingerprint,
	LogOut,
	Mail,
	Settings,
	User,
} from "lucide-react";
import { AddPasskeyDialog } from "@/components/add-passkey-dialog";
import { PasskeyList } from "@/components/passkey-list";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { signOut } from "@/lib/auth-client";

export const Route = createFileRoute("/_authed/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	const navigate = useNavigate();
	const { session } = Route.useRouteContext();

	const handleSignOut = async () => {
		await signOut();
		navigate({ to: "/login" });
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
			{/* Background decoration */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
				<div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
			</div>

			<div className="relative max-w-3xl mx-auto px-4 py-8">
				{/* Header */}
				<div className="flex items-center justify-between mb-8">
					<div className="flex items-center gap-4">
						<Button
							asChild
							variant="ghost"
							size="icon"
							className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
						>
							<Link to="/">
								<ArrowLeft className="h-5 w-5" />
							</Link>
						</Button>
						<div>
							<h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
								<Settings className="h-6 w-6" />
								Settings
							</h1>
							<p className="text-zinc-400 text-sm">
								Manage your account and security
							</p>
						</div>
					</div>
					<Button
						onClick={handleSignOut}
						variant="outline"
						className="border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400"
					>
						<LogOut className="mr-2 h-4 w-4" />
						Sign out
					</Button>
				</div>

				<div className="space-y-6">
					{/* Profile Section */}
					<Card className="bg-zinc-900/80 backdrop-blur-sm border-zinc-800">
						<CardHeader>
							<CardTitle className="text-zinc-100 flex items-center gap-2">
								<User className="h-5 w-5 text-emerald-500" />
								Profile
							</CardTitle>
							<CardDescription className="text-zinc-400">
								Your account information
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center gap-4">
								<div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500">
									<span className="text-2xl font-semibold text-white">
										{session.user.name?.charAt(0).toUpperCase() ||
											session.user.email?.charAt(0).toUpperCase() ||
											"U"}
									</span>
								</div>
								<div>
									<p className="text-lg font-medium text-zinc-100">
										{session.user.name || "User"}
									</p>
									<p className="text-zinc-400 flex items-center gap-1">
										<Mail className="h-4 w-4" />
										{session.user.email}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Passkeys Section */}
					<Card className="bg-zinc-900/80 backdrop-blur-sm border-zinc-800">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="text-zinc-100 flex items-center gap-2">
										<Fingerprint className="h-5 w-5 text-emerald-500" />
										Passkeys
									</CardTitle>
									<CardDescription className="text-zinc-400">
										Sign in securely without a password
									</CardDescription>
								</div>
								<AddPasskeyDialog />
							</div>
						</CardHeader>
						<CardContent>
							<PasskeyList />
						</CardContent>
					</Card>

					<Separator className="bg-zinc-800" />

					{/* Session Info */}
					<Card className="bg-zinc-900/80 backdrop-blur-sm border-zinc-800">
						<CardHeader>
							<CardTitle className="text-zinc-100 text-sm">
								Session Information
							</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="space-y-2 text-sm">
								<div className="flex justify-between">
									<dt className="text-zinc-500">User ID</dt>
									<dd className="text-zinc-300 font-mono text-xs">
										{session.user.id}
									</dd>
								</div>
								{session.user.emailVerified && (
									<div className="flex justify-between">
										<dt className="text-zinc-500">Email Verified</dt>
										<dd className="text-emerald-400">Yes</dd>
									</div>
								)}
							</dl>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

