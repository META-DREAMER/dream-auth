import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import {
	type InvitationViewerState,
	invitationViewerState,
} from "@/lib/invitation-accept-policy";
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

/**
 * How the invite page should treat the signed-in visitor (see
 * {@link InvitationViewerState}), or `null` when nobody is signed in or the
 * invitation is no longer pending. Reveals nothing about the invitation the
 * preview doesn't, only how it relates to the caller's own account.
 */
export const getInvitationViewerStateFn = createServerFn({ method: "GET" })
	.inputValidator(z.object({ invitationId: z.string().min(1).max(128) }))
	.handler(async ({ data }): Promise<InvitationViewerState | null> => {
		const session = await auth.api.getSession({
			headers: getRequestHeaders(),
		});
		if (!session) return null;

		const invitation = await pool.query<{
			email: string;
			walletAddress: string | null;
		}>(
			`SELECT email, "walletAddress" FROM invitation
			  WHERE id = $1 AND status = 'pending' AND "expiresAt" > NOW()`,
			[data.invitationId],
		);
		if (!invitation.rows[0]) return null;

		const accounts = await pool.query<{ accountId: string }>(
			`SELECT "accountId" FROM account WHERE "userId" = $1 AND "providerId" = 'siwe'`,
			[session.user.id],
		);
		return invitationViewerState({
			invitation: invitation.rows[0],
			user: session.user,
			siweAccountIds: accounts.rows.map((row) => row.accountId),
		});
	});
