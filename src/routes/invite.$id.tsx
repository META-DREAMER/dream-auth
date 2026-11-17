import {
	BuildingIcon,
	CheckIcon,
	ClockIcon,
	SpinnerIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode, useRef, useState } from "react";
import { z } from "zod";
import { ConnectSIWEButton } from "@/components/auth/connect-siwe-button";
import { EmailCodeSignIn } from "@/components/auth/email-code-sign-in";
import { usePasskeyPrompt } from "@/components/auth/passkey-prompt";
import { ErrorAlert } from "@/components/shared/error-alert";
import { PageBackground } from "@/components/shared/page-background";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { organization, signOut, useSession } from "@/lib/auth-client";
import type { InvitationPreview } from "@/lib/invitation-preview";
import { getInvitationPreviewFn } from "@/lib/invitation-preview.server";
import { navigateToSafeRedirect, resolveSafeRedirect } from "@/lib/redirect";

/** Same two parameters as `/login`: where to go once the invitee has joined. */
const searchSchema = z.object({
	redirect: z.string().optional(),
	rd: z.string().optional(),
});

export const Route = createFileRoute("/invite/$id")({
	ssr: false,
	validateSearch: searchSchema,
	beforeLoad: async ({ search }) => ({
		safeRedirect: await resolveSafeRedirect(search),
		hasRedirect: Boolean(search.redirect || search.rd),
	}),
	component: InvitePage,
});

type PendingInvitation = Extract<InvitationPreview, { state: "pending" }>;

/**
 * The invite link's page, and the whole of the invitee's journey: one card
 * with their name and the invited address (read-only); "Continue" emails a
 * code; the code signs them in (creating the account) and joins them to the
 * organization; then a passkey is offered. Someone already signed in as the
 * invitee gets a one-click Join; anyone else signed in, a way to switch.
 *
 * Opening the page has no side effects (link scanners open it too): the code
 * is sent only when "Continue" is clicked.
 */
function InvitePage() {
	const { id: invitationId } = Route.useParams();
	const { data: session, isPending: isSessionLoading } = useSession();
	const preview = useQuery({
		queryKey: ["invitation-preview", invitationId],
		queryFn: () => getInvitationPreviewFn({ data: { invitationId } }),
		retry: false,
	});

	// Only the first load shows the skeleton: the code sign-in refreshes the
	// session mid-flow, and unmounting the flow then would lose its state.
	const loaded = useRef(false);
	if (!loaded.current && (isSessionLoading || preview.isLoading)) {
		return <LoadingCard />;
	}
	loaded.current = true;

	const invitation = preview.data;
	if (!invitation || invitation.state !== "pending") {
		return <UnavailableCard state={invitation?.state ?? "not-found"} />;
	}

	return (
		<InviteFlow
			invitationId={invitationId}
			invitation={invitation}
			signedInEmail={session?.user.email ?? null}
		/>
	);
}

function InviteFlow({
	invitationId,
	invitation,
	signedInEmail,
}: {
	invitationId: string;
	invitation: PendingInvitation;
	signedInEmail: string | null;
}) {
	const { safeRedirect, hasRedirect } = Route.useRouteContext();
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [joined, setJoined] = useState(false);
	const [isJoining, setIsJoining] = useState(false);
	const { offerPasskey, prompt: passkeyPrompt } = usePasskeyPrompt();
	// Whether to show the sign-in form, fixed when the page opens: the sign-in
	// creates a session partway through, and the form must stay up until the
	// join has finished. A failed join drops to the signed-in Join card.
	const [signInFlow, setSignInFlow] = useState(signedInEmail === null);

	const inviter =
		invitation.inviterName ?? `an admin of ${invitation.organizationName}`;

	/** Accept the invitation for the current session; false on failure. */
	const join = async (): Promise<boolean> => {
		setError(null);
		const result = await organization
			.acceptInvitation({ invitationId })
			.catch(() => null);
		if (!result || result.error) {
			setError(
				result?.error?.message ||
					"Could not join the organization. Please try again.",
			);
			return false;
		}
		return true;
	};

	const finish = () => {
		if (hasRedirect) navigateToSafeRedirect(safeRedirect);
		else setJoined(true);
	};

	/** After a code or wallet sign-in: join, then (code only) offer a passkey. */
	const joinAfterSignIn = async (passkeyEmail?: string) => {
		if (!(await join())) {
			setSignInFlow(false);
			return;
		}
		if (passkeyEmail) await offerPasskey(passkeyEmail);
		finish();
	};

	const joinNow = async () => {
		setIsJoining(true);
		try {
			if (await join()) finish();
		} finally {
			setIsJoining(false);
		}
	};

	if (joined) {
		return (
			<CenteredCard>
				<CardHeader className="text-center">
					<IconBadge tone="success">
						<CheckIcon className="h-6 w-6 text-success" />
					</IconBadge>
					<CardTitle className="text-xl">
						You've joined {invitation.organizationName}
					</CardTitle>
					<CardDescription>You're all set.</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline" className="w-full">
						<Link to="/">Go to your account</Link>
					</Button>
				</CardContent>
			</CenteredCard>
		);
	}

	const header = (
		<CardHeader className="space-y-1 text-center">
			<IconBadge tone="primary">
				<BuildingIcon className="h-6 w-6 text-primary-foreground" />
			</IconBadge>
			<CardTitle className="text-2xl font-bold tracking-tight">
				Join {invitation.organizationName}
			</CardTitle>
			<CardDescription>
				{capitalize(inviter)} invited you to join.
			</CardDescription>
		</CardHeader>
	);

	if (!signInFlow && signedInEmail !== null) {
		const isInvitee =
			invitation.email === null ||
			invitation.email.toLowerCase() === signedInEmail.toLowerCase();
		return (
			<CenteredCard>
				{header}
				<CardContent className="space-y-4">
					{error && <ErrorAlert message={error} />}
					{isInvitee ? (
						<>
							<p className="text-sm text-muted-foreground text-center">
								Signed in as{" "}
								<span className="font-medium text-foreground">
									{signedInEmail}
								</span>
							</p>
							<Button onClick={joinNow} disabled={isJoining} className="w-full">
								{isJoining ? (
									<>
										<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
										Joining...
									</>
								) : (
									`Join ${invitation.organizationName}`
								)}
							</Button>
						</>
					) : (
						<>
							<p className="text-sm text-muted-foreground text-center">
								This invitation is for{" "}
								<span className="font-medium text-foreground">
									{invitation.email}
								</span>
								, but you're signed in as{" "}
								<span className="font-medium text-foreground">
									{signedInEmail}
								</span>
								.
							</p>
							<Button
								onClick={async () => {
									await signOut().catch(() => null);
									// Back to this same invite link, signed out.
									window.location.reload();
								}}
								className="w-full"
							>
								Switch account
							</Button>
						</>
					)}
				</CardContent>
			</CenteredCard>
		);
	}

	return (
		<CenteredCard
			before={
				passkeyPrompt && (
					<Card className="w-full max-w-md relative">
						<CardContent>{passkeyPrompt}</CardContent>
					</Card>
				)
			}
			// Hidden, not unmounted, while the passkey offer is up: the code
			// sign-in is still finishing underneath it.
			hidden={!!passkeyPrompt}
		>
			{header}
			<CardContent className="space-y-4">
				{error && <ErrorAlert message={error} />}
				{invitation.email === null ? (
					<>
						<p className="text-sm text-muted-foreground text-center">
							Connect the invited wallet{" "}
							<span className="font-mono text-foreground">
								{invitation.walletAddressPreview}
							</span>{" "}
							to join.
						</p>
						<ConnectSIWEButton
							onSuccess={() => joinAfterSignIn()}
							onError={setError}
						/>
					</>
				) : (
					<EmailCodeSignIn
						name={name}
						fixedEmail={invitation.email}
						sendLabel="Continue"
						wrongEmailHint={`Not your address? Ask ${inviter} to re-invite you.`}
						onSignedIn={(_data, email) => joinAfterSignIn(email)}
					>
						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								type="text"
								placeholder="Your name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								autoComplete="name"
							/>
						</div>
					</EmailCodeSignIn>
				)}
			</CardContent>
		</CenteredCard>
	);
}

const UNAVAILABLE_COPY = {
	expired: {
		title: "This invitation has expired",
		description: "Ask whoever invited you to send a new one.",
	},
	used: {
		title: "This invitation can't be used",
		description:
			"It has already been accepted, declined or cancelled. If you still need access, ask whoever invited you.",
	},
	"not-found": {
		title: "Invitation not found",
		description: "Check the link, or ask whoever invited you for a new one.",
	},
} as const;

function UnavailableCard({ state }: { state: keyof typeof UNAVAILABLE_COPY }) {
	const copy = UNAVAILABLE_COPY[state];
	return (
		<CenteredCard>
			<CardHeader className="text-center">
				{state === "expired" ? (
					<IconBadge tone="warning">
						<ClockIcon className="h-6 w-6 text-amber-400" />
					</IconBadge>
				) : (
					<IconBadge tone="error">
						<XIcon className="h-6 w-6 text-red-400" />
					</IconBadge>
				)}
				<CardTitle className="text-xl">{copy.title}</CardTitle>
				<CardDescription>{copy.description}</CardDescription>
			</CardHeader>
		</CenteredCard>
	);
}

function LoadingCard() {
	return (
		<CenteredCard>
			<CardHeader className="space-y-4">
				<Skeleton className="h-12 w-12 rounded-full mx-auto" />
				<Skeleton className="h-6 w-48 mx-auto" />
				<Skeleton className="h-4 w-64 mx-auto" />
			</CardHeader>
			<CardContent className="space-y-4">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</CardContent>
		</CenteredCard>
	);
}

function CenteredCard({
	children,
	before,
	hidden,
}: {
	children: ReactNode;
	before?: ReactNode;
	hidden?: boolean;
}) {
	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<PageBackground />
			{before}
			<Card className="w-full max-w-md relative" hidden={hidden}>
				{children}
			</Card>
		</div>
	);
}

const TONES = {
	primary: "bg-primary",
	success: "bg-success/20",
	warning: "bg-amber-500/20",
	error: "bg-red-500/20",
} as const;

function IconBadge({
	tone,
	children,
}: {
	tone: keyof typeof TONES;
	children: ReactNode;
}) {
	return (
		<div
			className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${TONES[tone]}`}
		>
			{children}
		</div>
	);
}

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}
