import { organization } from "@/lib/auth-client";

/** Shared options for the invite helpers. */
export type InviteOptions = {
	/**
	 * Re-send an existing pending invitation rather than creating a new one.
	 * Maps to better-auth's `resend` body flag, which refreshes `expiresAt` on
	 * the existing row and calls `sendInvitationEmail` again — so a failed send
	 * cannot destroy a working invitation.
	 */
	resend?: boolean;
};

/**
 * Invite a user by email address.
 * Creates a standard email invitation.
 *
 * The invitee signs in (or signs up) with an emailed code to accept.
 *
 * @param email - Email address to invite
 * @param role - Role to assign (e.g., "member", "admin", "owner")
 * @param organizationId - Organization to invite the user to
 * @param options.resend - Reuse the existing pending invitation instead of
 *   failing with "already invited". The row keeps its id, its expiry is
 *   refreshed and the email is sent again.
 */
export async function inviteByEmail(
	email: string,
	role: "member" | "admin" | "owner",
	organizationId: string,
	options: InviteOptions = {},
) {
	return organization.inviteMember({
		email: email.toLowerCase(),
		role,
		organizationId,
		...(options.resend ? { resend: true } : {}),
	});
}
