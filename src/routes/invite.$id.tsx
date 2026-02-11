import {
	BuildingIcon,
	CheckIcon,
	ClockIcon,
	EnvelopeIcon,
	SpinnerIcon,
	WalletIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useAccount } from "wagmi";
import { ConnectSIWEButton } from "@/components/auth/connect-siwe-button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { organization, useSession } from "@/lib/auth-client";
import { pool } from "@/lib/db";
import { formatAddress } from "@/lib/format";
import {
	getInvitationWalletAddress,
	isWalletInvitation,
} from "@/lib/invite-helpers";

/** Invitation details from the API (full details, requires auth) */
interface InvitationDetails {
	id: string;
	email: string;
	role: string;
	status: string;
	expiresAt: string | Date;
	organizationName: string;
	organizationSlug: string;
	inviterEmail: string;
	walletAddress?: string | null;
}

/**
 * Pre-auth invitation preview - shows essential details without requiring login.
 * Uses direct DB query because Better Auth's getInvitation requires authentication.
 * This is safe since users need the invite link to access this page, and we only expose read-only data.
 */
interface InvitationPreview {
	id: string;
	organizationName: string;
	role: string;
	status: string;
	expiresAt: string;
	isWalletInvitation: boolean;
	/** Masked wallet address for display (e.g., "0x1234...abcd") */
	walletAddressPreview?: string;
}

/**
 * Server function to fetch invitation preview without authentication.
 * This enables showing invitation details pre-auth for better UX.
 *
 * Note: Uses direct DB query because Better Auth's getInvitation endpoint
 * requires authentication. This is an acceptable exception per CLAUDE.md guidelines.
 */
const getInvitationPreview = createServerFn({ method: "GET" })
	.inputValidator((data: { invitationId: string }) => data)
	.handler(async ({ data }): Promise<InvitationPreview | null> => {
		const result = await pool.query(
			`SELECT
				i.id,
				i.role,
				i.status,
				i."expiresAt",
				i."walletAddress",
				o.name as "organizationName"
			FROM invitation i
			JOIN organization o ON i."organizationId" = o.id
			WHERE i.id = $1
			LIMIT 1`,
			[data.invitationId],
		);

		if (result.rows.length === 0) {
			return null;
		}

		const row = result.rows[0];
		const walletAddress = row.walletAddress as string | null;

		return {
			id: row.id,
			organizationName: row.organizationName,
			role: row.role,
			status: row.status,
			expiresAt: row.expiresAt,
			isWalletInvitation: !!walletAddress,
			walletAddressPreview: walletAddress
				? formatAddress(walletAddress)
				: undefined,
		};
	});

export const Route = createFileRoute("/invite/$id")({
	ssr: false,
	component: InvitePage,
});

function InvitePage() {
	const { id: invitationId } = Route.useParams();
	const navigate = useNavigate();
	const { data: session, isPending: isSessionLoading } = useSession();
	const { address: connectedWallet } = useAccount();

	// Fetch invitation preview (works without auth - for pre-login display)
	const {
		data: invitationPreview,
		isLoading: isLoadingPreview,
		error: previewError,
	} = useQuery({
		queryKey: ["invitation-preview", invitationId],
		queryFn: () => getInvitationPreview({ data: { invitationId } }),
		// Always fetch - this works without auth
		enabled: true,
		// Cache for 5 minutes
		staleTime: 1000 * 60 * 5,
		retry: false,
	});

	// Fetch full invitation details (requires auth - for accept/reject actions)
	const {
		data: invitation,
		isLoading: isLoadingInvitation,
		error: invitationError,
	} = useQuery({
		queryKey: ["invitation", invitationId],
		queryFn: async (): Promise<InvitationDetails> => {
			const result = await organization.getInvitation({
				query: { id: invitationId },
			});

			if (result.error) {
				throw new Error(
					result.error.message || "Failed to load invitation details",
				);
			}

			if (!result.data) {
				throw new Error("Invitation not found");
			}

			return result.data as InvitationDetails;
		},
		// Only fetch when user is logged in
		enabled: !!session,
		// Cache invitation data for 5 minutes
		staleTime: 1000 * 60 * 5,
		retry: false,
	});

	// Accept invitation mutation
	const acceptMutation = useMutation({
		mutationFn: async () => {
			const result = await organization.acceptInvitation({
				invitationId,
			});

			if (result.error) {
				throw new Error(result.error.message || "Failed to accept invitation");
			}

			return result.data;
		},
		onSuccess: () => {
			// Redirect to settings after a short delay to show success message
			setTimeout(() => {
				navigate({ to: "/settings" });
			}, 2000);
		},
	});

	// Reject invitation mutation
	const rejectMutation = useMutation({
		mutationFn: async () => {
			const result = await organization.rejectInvitation({
				invitationId,
			});

			if (result.error) {
				throw new Error(result.error.message || "Failed to reject invitation");
			}

			return result.data;
		},
		onSuccess: () => {
			navigate({ to: "/" });
		},
	});

	// Check if the connected wallet matches the invitation wallet
	const invitationWallet = invitation
		? getInvitationWalletAddress(invitation)
		: null;
	const isWalletInvite = invitation ? isWalletInvitation(invitation) : false;
	const walletMatches =
		isWalletInvite &&
		connectedWallet &&
		invitationWallet &&
		connectedWallet.toLowerCase() === invitationWallet.toLowerCase();

	// Combine error from query or mutations
	const error =
		acceptMutation.error?.message ||
		rejectMutation.error?.message ||
		(invitationError instanceof Error ? invitationError.message : null);

	// Loading state while checking session or fetching preview
	if (isSessionLoading || isLoadingPreview) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<PageBackground />
				<Card className="w-full max-w-md relative">
					<CardHeader className="space-y-4">
						<Skeleton className="h-12 w-12 rounded-full mx-auto" />
						<Skeleton className="h-6 w-48 mx-auto" />
						<Skeleton className="h-4 w-64 mx-auto" />
					</CardHeader>
					<CardContent className="space-y-4">
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-10 w-full" />
					</CardContent>
				</Card>
			</div>
		);
	}

	// Invitation not found (pre-auth check)
	if (previewError || !invitationPreview) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<PageBackground />
				<Card className="w-full max-w-md relative">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
							<XIcon className="h-6 w-6 text-red-400" />
						</div>
						<CardTitle className="text-xl">Invitation Not Found</CardTitle>
						<CardDescription>
							This invitation may have expired, been canceled, or doesn't exist.
						</CardDescription>
					</CardHeader>
					<CardFooter className="justify-center">
						<Button asChild variant="outline">
							<Link to="/">Go Home</Link>
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	// Check if invitation is expired or not pending
	const isExpired = new Date(invitationPreview.expiresAt) < new Date();
	const isNotPending = invitationPreview.status !== "pending";

	if (isExpired || isNotPending) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<PageBackground />
				<Card className="w-full max-w-md relative">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
							<ClockIcon className="h-6 w-6 text-amber-400" />
						</div>
						<CardTitle className="text-xl">
							{isExpired
								? "Invitation Expired"
								: "Invitation No Longer Available"}
						</CardTitle>
						<CardDescription>
							{isExpired
								? `This invitation to join ${invitationPreview.organizationName} has expired.`
								: `This invitation to join ${invitationPreview.organizationName} is no longer available (status: ${invitationPreview.status}).`}
						</CardDescription>
					</CardHeader>
					<CardFooter className="justify-center">
						<Button asChild variant="outline">
							<Link to="/">Go Home</Link>
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	// Not logged in - show invitation preview with login prompt
	if (!session) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<PageBackground />
				<Card className="w-full max-w-md relative">
					<CardHeader className="space-y-1 text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
							<BuildingIcon className="h-6 w-6 text-white" />
						</div>
						<CardTitle className="text-xl font-bold tracking-tight">
							Join {invitationPreview.organizationName}
						</CardTitle>
						<CardDescription>
							You've been invited to join as{" "}
							<Badge
								variant="outline"
								className="ml-1 border-success/30 text-success bg-success/10"
							>
								{invitationPreview.role}
							</Badge>
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-4">
						{/* Invitation preview details */}
						<div className="rounded-lg bg-muted border p-4 space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">
									Organization
								</span>
								<span className="text-sm font-medium">
									{invitationPreview.organizationName}
								</span>
							</div>
							<Separator />
							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">Expires</span>
								<span className="text-sm flex items-center gap-1">
									<ClockIcon className="h-3 w-3" />
									{new Date(invitationPreview.expiresAt).toLocaleDateString()}
								</span>
							</div>
							{invitationPreview.isWalletInvitation && (
								<>
									<Separator />
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">
											Required Wallet
										</span>
										<span className="text-sm font-mono flex items-center gap-1">
											<WalletIcon className="h-3 w-3" />
											{invitationPreview.walletAddressPreview}
										</span>
									</div>
								</>
							)}
						</div>

						{/* Sign in prompt */}
						<div className="rounded-lg bg-muted/50 border p-3">
							<p className="text-sm text-muted-foreground text-center">
								Sign in to accept or decline this invitation
							</p>
						</div>

						{invitationPreview.isWalletInvitation ? (
							<>
								<ConnectSIWEButton />
								<div className="relative">
									<div className="absolute inset-0 flex items-center">
										<Separator className="w-full" />
									</div>
									<div className="relative flex justify-center text-xs uppercase">
										<span className="bg-background px-2 text-muted-foreground">
											or sign in with email first
										</span>
									</div>
								</div>
								<Button asChild variant="outline" className="w-full">
									<Link
										to="/login"
										search={{ redirect: `/invite/${invitationId}` }}
									>
										<EnvelopeIcon className="mr-2 h-4 w-4" />
										Sign in with Email
									</Link>
								</Button>
							</>
						) : (
							<>
								<Button asChild className="w-full font-medium">
									<Link
										to="/login"
										search={{ redirect: `/invite/${invitationId}` }}
									>
										<EnvelopeIcon className="mr-2 h-4 w-4" />
										Sign in with Email
									</Link>
								</Button>
								<div className="relative">
									<div className="absolute inset-0 flex items-center">
										<Separator className="w-full" />
									</div>
									<div className="relative flex justify-center text-xs uppercase">
										<span className="bg-background px-2 text-muted-foreground">
											or connect wallet
										</span>
									</div>
								</div>
								<ConnectSIWEButton />
							</>
						)}
					</CardContent>

					<CardFooter className="flex flex-col">
						<p className="text-center text-sm text-muted-foreground">
							Don't have an account?{" "}
							<Link
								to="/register"
								search={{ redirect: `/invite/${invitationId}` }}
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

	// Loading invitation details
	if (isLoadingInvitation) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<PageBackground />
				<Card className="w-full max-w-md relative">
					<CardHeader className="space-y-4">
						<Skeleton className="h-12 w-12 rounded-full mx-auto" />
						<Skeleton className="h-6 w-48 mx-auto" />
						<Skeleton className="h-4 w-64 mx-auto" />
					</CardHeader>
					<CardContent className="space-y-4">
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-10 w-full" />
					</CardContent>
				</Card>
			</div>
		);
	}

	// Error loading invitation (and no cached data)
	if (invitationError && !invitation) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<PageBackground />
				<Card className="w-full max-w-md relative">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
							<XIcon className="h-6 w-6 text-red-400" />
						</div>
						<CardTitle className="text-xl">Invitation Not Found</CardTitle>
						<CardDescription>
							{invitationError instanceof Error
								? invitationError.message
								: "Failed to load invitation. It may have expired or been canceled."}
						</CardDescription>
					</CardHeader>
					<CardFooter className="justify-center">
						<Button asChild variant="outline">
							<Link to="/">Go Home</Link>
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	// Success state
	if (acceptMutation.isSuccess) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<PageBackground />
				<Card className="w-full max-w-md relative">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/20">
							<CheckIcon className="h-6 w-6 text-success" />
						</div>
						<CardTitle className="text-xl">
							Welcome to {invitation?.organizationName}!
						</CardTitle>
						<CardDescription>
							You've successfully joined as {invitation?.role}. Redirecting...
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	// Show invitation details
	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<PageBackground />

			<Card className="w-full max-w-md relative">
				<CardHeader className="space-y-1 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
						<BuildingIcon className="h-6 w-6 text-primary-foreground" />
					</div>
					<CardTitle className="text-xl font-bold tracking-tight">
						Join {invitation?.organizationName}
					</CardTitle>
					<CardDescription>
						You've been invited to join as{" "}
						<Badge
							variant="outline"
							className="ml-1 border-success/30 text-success bg-success/10"
						>
							{invitation?.role}
						</Badge>
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					{error && <ErrorAlert message={error} />}

					{/* Invitation details */}
					<div className="rounded-lg bg-muted border p-4 space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">
								Organization
							</span>
							<span className="text-sm font-medium">
								{invitation?.organizationName}
							</span>
						</div>
						<Separator />
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">Invited by</span>
							<span className="text-sm font-medium">
								{invitation?.inviterEmail}
							</span>
						</div>
						<Separator />
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">Expires</span>
							<span className="text-sm flex items-center gap-1">
								<ClockIcon className="h-3 w-3" />
								{invitation?.expiresAt
									? new Date(invitation.expiresAt).toLocaleDateString()
									: "N/A"}
							</span>
						</div>

						{/* Wallet invitation indicator */}
						{isWalletInvite && (
							<>
								<Separator />
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">
										Required Wallet
									</span>
									<span className="text-sm font-mono flex items-center gap-1">
										<WalletIcon className="h-3 w-3" />
										{formatAddress(invitationWallet)}
									</span>
								</div>
							</>
						)}
					</div>

					{/* Wallet mismatch warning */}
					{isWalletInvite && connectedWallet && !walletMatches && (
						<div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
							<p className="text-sm text-amber-400">
								<strong>Wrong wallet connected.</strong> This invitation
								requires you to sign in with wallet{" "}
								<span className="font-mono">
									{formatAddress(invitationWallet)}
								</span>
							</p>
						</div>
					)}

					{/* Wallet invitation - need to connect correct wallet */}
					{isWalletInvite && !walletMatches && (
						<ConnectSIWEButton
							onSuccess={() => {
								// Re-fetch invitation after wallet connection
								window.location.reload();
							}}
						/>
					)}
				</CardContent>

				<CardFooter className="flex gap-3">
					<Button
						onClick={() => rejectMutation.mutate()}
						disabled={acceptMutation.isPending || rejectMutation.isPending}
						variant="outline"
						className="flex-1 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive"
					>
						{rejectMutation.isPending ? (
							<>
								<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
								Declining...
							</>
						) : (
							<>
								<XIcon className="mr-2 h-4 w-4" />
								Decline
							</>
						)}
					</Button>
					<Button
						onClick={() => acceptMutation.mutate()}
						disabled={
							acceptMutation.isPending ||
							rejectMutation.isPending ||
							(isWalletInvite && !walletMatches)
						}
						className="flex-1 font-medium"
					>
						{acceptMutation.isPending ? (
							<>
								<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
								Accepting...
							</>
						) : (
							<>
								<CheckIcon className="mr-2 h-4 w-4" />
								Accept
							</>
						)}
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
