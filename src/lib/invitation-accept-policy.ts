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
	const wallet = input.invitationWalletAddress?.toLowerCase();
	if (!wallet) {
		return input.userEmailVerified
			? null
			: "Verify your email address before accepting this invitation.";
	}
	const ids = await input.siweAccountIds();
	return ids.some((id) => id.toLowerCase().startsWith(`${wallet}:`))
		? null
		: "You must sign in with the invited wallet address to accept this invitation.";
}
