import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pool } from "@/lib/db";
import {
	type InvitationPreview,
	type InvitationPreviewRow,
	toInvitationPreview,
} from "@/lib/invitation-preview";

/**
 * The invite page's lookup, before sign-in. A direct query because
 * better-auth's `getInvitation` requires the invitee's session, which is what
 * this page exists to create. Keyed by id only; see {@link InvitationPreview}
 * for what it returns.
 */
export const getInvitationPreviewFn = createServerFn({ method: "GET" })
	.inputValidator(z.object({ invitationId: z.string().min(1).max(128) }))
	.handler(async ({ data }): Promise<InvitationPreview> => {
		const result = await pool.query<InvitationPreviewRow>(
			`SELECT i.email, i.status, i."expiresAt", i."walletAddress",
			        o.name AS "organizationName", u.name AS "inviterName"
			   FROM invitation i
			   JOIN organization o ON o.id = i."organizationId"
			   LEFT JOIN "user" u ON u.id = i."inviterId"
			  WHERE i.id = $1
			  LIMIT 1`,
			[data.invitationId],
		);
		return toInvitationPreview(result.rows[0]);
	});
