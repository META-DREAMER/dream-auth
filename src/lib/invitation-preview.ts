/**
 * What the invite page may know about an invitation before anyone signs in.
 *
 * The page is public: whoever holds the link (an unguessable id) sees it. So
 * a pending invitation yields only what the invitee needs to finish the one
 * form - the address the code goes to, the organization and who invited them
 * - and anything else yields its state alone: no organization, no address.
 */
export type InvitationPreview =
	| {
			state: "pending";
			/** Where the sign-in code goes. */
			email: string;
			organizationName: string;
			inviterName: string | null;
	  }
	| { state: "expired" | "used" | "not-found" };

/** The columns {@link toInvitationPreview} reads. */
export interface InvitationPreviewRow {
	email: string;
	status: string;
	expiresAt: Date | string;
	organizationName: string;
	inviterName: string | null;
}

export function toInvitationPreview(
	row: InvitationPreviewRow | undefined,
	now: Date = new Date(),
): InvitationPreview {
	if (!row) return { state: "not-found" };
	// Accepted, rejected and canceled all read the same to the visitor: this
	// link no longer does anything.
	if (row.status !== "pending") return { state: "used" };
	if (new Date(row.expiresAt) <= now) return { state: "expired" };

	return {
		state: "pending",
		email: row.email,
		organizationName: row.organizationName,
		inviterName: row.inviterName?.trim() || null,
	};
}
