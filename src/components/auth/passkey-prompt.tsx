import { FingerprintIcon, SpinnerIcon } from "@phosphor-icons/react";
import { type ReactNode, useCallback, useState } from "react";
import { ErrorAlert } from "@/components/shared/error-alert";
import { Button } from "@/components/ui/button";
import { passkey } from "@/lib/auth-client";

/** A "Not now" keeps the offer away from this browser for this long. */
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000;

const dismissKey = (email: string) =>
	`dream-auth:passkey-prompt-dismissed:${email.toLowerCase()}`;

function recentlyDismissed(email: string): boolean {
	try {
		const at = Number(localStorage.getItem(dismissKey(email)));
		return Number.isFinite(at) && Date.now() - at < DISMISS_FOR_MS;
	} catch {
		return false;
	}
}

function rememberDismissal(email: string): void {
	try {
		localStorage.setItem(dismissKey(email), String(Date.now()));
	} catch {
		// Storage blocked: the offer just comes back next time.
	}
}

/**
 * Offer a passkey to someone who just signed in with an email code and has
 * none, unless this browser can't make one or they said "Not now" recently.
 *
 * Call `offerPasskey` right after the code sign-in: registering a passkey
 * needs the session that sign-in created to still be fresh. It resolves once
 * the person has added a passkey or skipped; until then `prompt` holds the
 * card content to render in place of the sign-in form.
 */
export function usePasskeyPrompt(): {
	offerPasskey: (email: string) => Promise<void>;
	prompt: ReactNode;
} {
	const [offer, setOffer] = useState<{
		email: string;
		finish: () => void;
	} | null>(null);

	const offerPasskey = useCallback(async (email: string) => {
		if (typeof window === "undefined" || !window.PublicKeyCredential) return;
		if (recentlyDismissed(email)) return;
		const existing = await passkey.listUserPasskeys().catch(() => null);
		// An error (passkeys disabled on this server, say) means no offer.
		if (!existing?.data || existing.data.length > 0) return;

		await new Promise<void>((resolve) => {
			setOffer({
				email,
				finish: () => {
					setOffer(null);
					resolve();
				},
			});
		});
	}, []);

	const prompt = offer ? (
		<PasskeyPrompt
			onAdded={offer.finish}
			onSkip={() => {
				rememberDismissal(offer.email);
				offer.finish();
			}}
		/>
	) : null;

	return { offerPasskey, prompt };
}

function PasskeyPrompt({
	onAdded,
	onSkip,
}: {
	onAdded: () => void;
	onSkip: () => void;
}) {
	const [error, setError] = useState<string | null>(null);
	const [isAdding, setIsAdding] = useState(false);

	const addPasskey = async () => {
		setError(null);
		setIsAdding(true);
		try {
			const result = await passkey.addPasskey();
			if (result?.error) {
				setError(result.error.message || "Could not add a passkey");
				return;
			}
			onAdded();
		} catch {
			setError("Could not add a passkey. Please try again.");
		} finally {
			setIsAdding(false);
		}
	};

	return (
		<div className="space-y-4 text-center">
			<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
				<FingerprintIcon className="h-6 w-6 text-primary" />
			</div>
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">Skip the code next time</h2>
				<p className="text-sm text-muted-foreground">
					Add a passkey and sign in with your fingerprint, face or device PIN
					instead of waiting for an email.
				</p>
			</div>
			{error && <ErrorAlert message={error} />}
			<Button onClick={addPasskey} disabled={isAdding} className="w-full">
				{isAdding ? (
					<>
						<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
						Adding passkey...
					</>
				) : (
					"Add a passkey"
				)}
			</Button>
			<Button
				variant="ghost"
				onClick={onSkip}
				disabled={isAdding}
				className="w-full"
			>
				Not now
			</Button>
		</div>
	);
}
