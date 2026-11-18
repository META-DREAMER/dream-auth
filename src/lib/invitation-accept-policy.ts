/**
 * Who may accept an invitation, beyond better-auth's own check that the
 * session's email equals the invitation's.
 *
 * - An email invitation needs a verified email. `changeEmail` with
 *   `updateEmailWithoutVerification` lets an unverified account (a wallet
 *   user's placeholder, say) set its email to any address without proving
 *   it, so the email match alone would let it accept a leaked invite link.
 *   better-auth's `requireEmailVerificationOnInvitation` would do this for
 *   every invitation, and wallet users never have a verified email.
 * - A wallet invitation needs a SIWE account for the invited wallet
 *   (`accountId` is `<address>:<chainId>`).
 *
 * Returns the reason to refuse, or `null` to allow.
 */
export async function invitationAcceptRefusal(input: {
	invitationWalletAddress: string | null | undefined;
	userEmailVerified: boolean;
	siweAccountIds: () => Promise<string[]>;
}): Promise<string | null> {
	const wallet = input.invitationWalletAddress;
	if (!wallet) {
		return input.userEmailVerified
			? null
			: "Verify your email address before accepting this invitation.";
	}
	return hasWallet(await input.siweAccountIds(), wallet)
		? null
		: "You must sign in with the invited wallet address to accept this invitation.";
}

function hasWallet(siweAccountIds: string[], wallet: string): boolean {
	const prefix = `${wallet.toLowerCase()}:`;
	return siweAccountIds.some((id) => id.toLowerCase().startsWith(prefix));
}

/**
 * How the invite page should treat the signed-in visitor, by the same rules
 * the accept endpoint applies (better-auth's email match, then the checks
 * above), so the page never offers a Join that is bound to fail.
 *
 * - `invitee`: Join works.
 * - `unverified`: the invited email, not yet proven; verify, then Join.
 * - `other-account`: someone else; switching accounts is the way forward.
 * - `wallet-account-mismatch`: the invited wallet is linked to this account,
 *   but the account's email is not the wallet invitation's derived address,
 *   which better-auth requires. No sign-in can fix that; the admin has to
 *   invite the account's email instead.
 */
export type InvitationViewerState =
	| "invitee"
	| "unverified"
	| "other-account"
	| "wallet-account-mismatch";

export function invitationViewerState(input: {
	invitation: { email: string; walletAddress: string | null };
	user: { email: string; emailVerified: boolean };
	siweAccountIds: string[];
}): InvitationViewerState {
	const { invitation, user } = input;
	const emailMatches =
		invitation.email.toLowerCase() === user.email.toLowerCase();

	if (invitation.walletAddress) {
		if (!hasWallet(input.siweAccountIds, invitation.walletAddress)) {
			return "other-account";
		}
		return emailMatches ? "invitee" : "wallet-account-mismatch";
	}

	if (!emailMatches) return "other-account";
	return user.emailVerified ? "invitee" : "unverified";
}
