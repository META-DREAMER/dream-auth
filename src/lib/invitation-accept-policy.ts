/**
 * Who may accept an invitation, beyond better-auth's own check that the
 * session's email equals the invitation's.
 *
 * An invitation needs a verified email. `changeEmail` with
 * `updateEmailWithoutVerification` lets an unverified account set its email
 * to any address without proving it, so the email match alone would let it
 * accept a leaked invite link.
 *
 * Returns the reason to refuse, or `null` to allow.
 */
export function invitationAcceptRefusal(input: {
	userEmailVerified: boolean;
}): string | null {
	return input.userEmailVerified
		? null
		: "Verify your email address before accepting this invitation.";
}

/**
 * How the invite page should treat the signed-in visitor, by the same rules
 * the accept endpoint applies (better-auth's email match, then the check
 * above), so the page never offers a Join that is bound to fail.
 *
 * - `invitee`: Join works.
 * - `unverified`: the invited email, not yet proven; verify, then Join.
 * - `other-account`: someone else; switching accounts is the way forward.
 */
export type InvitationViewerState = "invitee" | "unverified" | "other-account";

export function invitationViewerState(input: {
	invitation: { email: string };
	user: { email: string; emailVerified: boolean };
}): InvitationViewerState {
	const { invitation, user } = input;
	if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
		return "other-account";
	}
	return user.emailVerified ? "invitee" : "unverified";
}
