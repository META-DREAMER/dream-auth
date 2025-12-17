import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	Building2,
	Fingerprint,
	LogOut,
	Mail,
	Settings,
	User,
	Wallet,
} from "lucide-react";
import { AddPasskeyDialog } from "@/components/auth/add-passkey-dialog";
import { ChangeEmailDialog } from "@/components/auth/change-email-dialog";
import { LinkEmailDialog } from "@/components/auth/link-email-dialog";
import { LinkWalletDialog } from "@/components/auth/link-wallet-dialog";
import { VerifyEmailDialog } from "@/components/auth/verify-email-dialog";
import { PasskeyList } from "@/components/auth/passkey-list";
import { WalletList } from "@/components/auth/wallet-list";
import { PageBackground } from "@/components/shared/page-background";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSignOut } from "@/hooks/use-sign-out";
import { getRealEmail } from "@/lib/utils";

export const Route = createFileRoute("/_authed/settings")({
	component: SettingsPage,
	ssr: false,
});

function SettingsPage() {
	const { session } = Route.useRouteContext();
	const handleSignOut = useSignOut();
	
	// Filter out SIWE-generated placeholder emails (walletAddress@domain)
	const realEmail = getRealEmail(session.user.email);

	return (
		<div className="min-h-screen bg-background">
			<PageBackground />

			<div className="relative max-w-3xl mx-auto px-4 py-8">
				{/* Header */}
				<div className="flex items-center justify-between mb-8">
					<div className="flex items-center gap-4">
						<Button
							asChild
							variant="ghost"
							size="icon"
						>
							<Link to="/">
								<ArrowLeft className="h-5 w-5" />
							</Link>
						</Button>
						<div>
							<h1 className="text-2xl font-bold flex items-center gap-2">
								<Settings className="h-6 w-6" />
								Settings
							</h1>
							<p className="text-muted-foreground text-sm">
								Manage your account and security
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button
							asChild
							variant="outline"
						>
							<Link to="/org">
								<Building2 className="mr-2 h-4 w-4" />
								Organizations
							</Link>
						</Button>
						<Button
							onClick={handleSignOut}
							variant="outline"
							className="hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive-foreground"
						>
							<LogOut className="mr-2 h-4 w-4" />
							Sign out
						</Button>
					</div>
				</div>

				<div className="space-y-6">
					{/* Profile Section */}
					<Card>
						<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<User className="h-5 w-5 text-success" />
							Profile
						</CardTitle>
							<CardDescription>
								Your account information
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center gap-4">
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
								<span className="text-2xl font-semibold text-primary-foreground">
									{session.user.name?.charAt(0).toUpperCase() ||
										realEmail?.charAt(0).toUpperCase() ||
										"U"}
								</span>
							</div>
								<div>
									<p className="text-lg font-medium">
										{session.user.name || "User"}
									</p>
									{realEmail && (
										<p className="text-muted-foreground flex items-center gap-1">
											<Mail className="h-4 w-4" />
											{realEmail}
										</p>
									)}
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Email Section */}
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<Mail className="h-5 w-5 text-blue-500" />
										Email
									</CardTitle>
									<CardDescription>
										Link an email address for account recovery
									</CardDescription>
								</div>
								{realEmail && session.user.emailVerified ? (
									<ChangeEmailDialog />
								) : (
									<LinkEmailDialog />
								)}
							</div>
						</CardHeader>
						<CardContent>
							{realEmail ? (
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Mail className="h-4 w-4 text-muted-foreground" />
										<span>{realEmail}</span>
										<Badge
											variant={session.user.emailVerified ? "default" : "secondary"}
											className={
												session.user.emailVerified
													? "bg-success/20 text-success border-success/30"
													: ""
											}
										>
											{session.user.emailVerified ? "Verified" : "Unverified"}
										</Badge>
									</div>
									<div className="flex items-center gap-2">
										
										{!session.user.emailVerified && (
											<VerifyEmailDialog email={realEmail} />
										)}
									</div>
								</div>
							) : (
								<p className="text-muted-foreground text-sm">
									No email linked to your account yet. Add one for easier recovery.
								</p>
							)}
						</CardContent>
					</Card>

					{/* Passkeys Section */}
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
								<CardTitle className="flex items-center gap-2">
									<Fingerprint className="h-5 w-5 text-success" />
									Passkeys
								</CardTitle>
									<CardDescription>
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

					{/* Wallets Section */}
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<Wallet className="h-5 w-5 text-orange-500" />
										Linked Wallets
									</CardTitle>
									<CardDescription>
										Sign in with your Ethereum wallet
									</CardDescription>
								</div>
								<LinkWalletDialog />
							</div>
						</CardHeader>
						<CardContent>
							<WalletList />
						</CardContent>
					</Card>

					<Separator />

					{/* Session Info */}
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">
								Session Information
							</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="space-y-2 text-sm">
								<div className="flex justify-between">
									<dt className="text-muted-foreground">User ID</dt>
									<dd className="font-mono text-xs">
										{session.user.id}
									</dd>
								</div>
								{realEmail && session.user.emailVerified && (
								<div className="flex justify-between">
									<dt className="text-muted-foreground">Email Verified</dt>
									<dd className="text-success">Yes</dd>
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
