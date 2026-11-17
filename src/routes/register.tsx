import { UserPlusIcon } from "@phosphor-icons/react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { EmailCodeSignIn } from "@/components/auth/email-code-sign-in";
import { usePasskeyPrompt } from "@/components/auth/passkey-prompt";
import { PageBackground } from "@/components/shared/page-background";
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
import {
	isInternalRedirect,
	navigateToSafeRedirect,
	resolveSafeRedirect,
} from "@/lib/redirect";

/** Same two parameters as `/login`; see the note there. */
const searchSchema = z.object({
	redirect: z.string().optional(),
	rd: z.string().optional(),
});

export const Route = createFileRoute("/register")({
	validateSearch: searchSchema,
	beforeLoad: async ({ context, search }) => {
		const safeRedirect = await resolveSafeRedirect(search);

		if (context.session) {
			throw redirect(
				isInternalRedirect(safeRedirect)
					? { to: safeRedirect }
					: { href: safeRedirect, reloadDocument: true },
			);
		}

		return { safeRedirect };
	},
	component: RegisterPage,
});

/**
 * Sign-up without a password: name and email, then the emailed code. The
 * code sign-in creates the account (email verified) when the server's invite
 * gate admits the address, offers a passkey, then returns to the invite.
 */
function RegisterPage() {
	const { safeRedirect } = Route.useRouteContext();
	const [name, setName] = useState("");
	const { offerPasskey, prompt: passkeyPrompt } = usePasskeyPrompt();

	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<PageBackground />

			{passkeyPrompt && (
				<Card className="w-full max-w-md relative">
					<CardContent>{passkeyPrompt}</CardContent>
				</Card>
			)}

			{/* Hidden, not unmounted, while the passkey offer is up: the code
			    sign-in is still finishing underneath it. */}
			<Card className="w-full max-w-md relative" hidden={!!passkeyPrompt}>
				<CardHeader className="space-y-1 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
						<UserPlusIcon className="h-6 w-6 text-primary-foreground" />
					</div>
					<CardTitle className="text-2xl font-bold tracking-tight">
						Create an account
					</CardTitle>
					<CardDescription>
						No password needed: we'll email you a code
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					<EmailCodeSignIn
						name={name}
						onSignedIn={async (_data, email) => {
							await offerPasskey(email);
							navigateToSafeRedirect(safeRedirect);
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								type="text"
								placeholder="John Doe"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								autoComplete="name"
							/>
						</div>
					</EmailCodeSignIn>
				</CardContent>

				<CardFooter className="flex flex-col gap-4">
					<p className="text-center text-sm text-muted-foreground">
						Already have an account?{" "}
						<Link
							to="/login"
							search={{ redirect: safeRedirect }}
							className="text-primary hover:text-primary/80 font-medium transition-colors"
						>
							Sign in
						</Link>
					</p>
				</CardFooter>
			</Card>
		</div>
	);
}
