import {
	ArrowSquareOutIcon,
	ProhibitIcon,
	SignOutIcon,
} from "@phosphor-icons/react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useDisconnect } from "wagmi";
import { z } from "zod";
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
import { signOut } from "@/lib/auth-client";
import {
	DEFAULT_REDIRECT,
	isInternalRedirect,
	resolveSafeRedirect,
} from "@/lib/redirect";

/**
 * Where forward auth sends a signed-in user who is not allowed into an app.
 *
 * `redirect` is the sanitized URL of the app they were denied - the same
 * value `/login` receives - and it is validated again here before anything
 * is displayed or navigated. Nothing on this page is built from raw input.
 */
const searchSchema = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute("/forbidden")({
	validateSearch: searchSchema,
	ssr: false,
	beforeLoad: async ({ context, search }) => {
		const safeRedirect = await resolveSafeRedirect(search);

		// Nobody to be forbidden: the login page can send them back to the app
		// once they have signed in.
		if (!context.session) {
			throw redirect({
				to: "/login",
				search: {
					redirect:
						safeRedirect === DEFAULT_REDIRECT ? undefined : safeRedirect,
				},
			});
		}

		return { session: context.session, safeRedirect };
	},
	component: ForbiddenPage,
});

/** Host of the denied app, for display only, or `null` when unknown. */
function appHostOf(safeRedirect: string): string | null {
	if (safeRedirect === DEFAULT_REDIRECT || isInternalRedirect(safeRedirect)) {
		return null;
	}
	try {
		return new URL(safeRedirect).host;
	} catch {
		return null;
	}
}

function ForbiddenPage() {
	const { session, safeRedirect } = Route.useRouteContext();
	const { disconnect } = useDisconnect();
	const [isSigningOut, setIsSigningOut] = useState(false);

	const appHost = appHostOf(safeRedirect);
	const loginSearch = {
		redirect: safeRedirect === DEFAULT_REDIRECT ? undefined : safeRedirect,
	};

	const handleSwitchAccount = async () => {
		setIsSigningOut(true);
		try {
			disconnect();
			await signOut();
		} finally {
			// A full document load: the login page must start from a clean
			// session, and the app URL survives as the return-to.
			const login = new URL("/login", window.location.origin);
			if (loginSearch.redirect) {
				login.searchParams.set("redirect", loginSearch.redirect);
			}
			window.location.assign(login.toString());
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<PageBackground />

			<Card className="relative w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
						<ProhibitIcon className="h-8 w-8 text-destructive" />
					</div>
					<CardTitle className="text-2xl">Access denied</CardTitle>
					<CardDescription>
						{appHost ? (
							<>
								Your account does not have access to{" "}
								<span className="font-mono text-foreground">{appHost}</span>.
							</>
						) : (
							"Your account does not have access to this app."
						)}
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					<div className="rounded-lg border bg-muted/40 p-4 text-sm">
						<p className="text-muted-foreground">Signed in as</p>
						<p className="font-medium">{session.user.name || "User"}</p>
						<p className="text-muted-foreground break-all">
							{session.user.email}
						</p>
					</div>
					<p className="text-sm text-muted-foreground">
						Access is granted by an organization owner or admin. If you were
						expecting to get in, ask them to add you to the right team - or sign
						in with a different account.
					</p>
				</CardContent>

				<CardFooter className="flex flex-col gap-2">
					<Button
						className="w-full"
						onClick={handleSwitchAccount}
						disabled={isSigningOut}
					>
						<SignOutIcon className="mr-2 h-4 w-4" />
						Sign out and switch account
					</Button>
					{appHost && (
						<Button asChild variant="outline" className="w-full">
							<a href={safeRedirect}>
								<ArrowSquareOutIcon className="mr-2 h-4 w-4" />
								Try {appHost} again
							</a>
						</Button>
					)}
					<Button asChild variant="ghost" className="w-full">
						<Link to="/">Back to Auth Server</Link>
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
