import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

/**
 * An organization, its owner (the inviter) and one email invitation for
 * `email`. Pending and valid for a day unless `status` or `expired` say
 * otherwise.
 */
export async function seedInvitation(
	pool: Pool,
	email: string,
	options: {
		status?: "pending" | "accepted" | "rejected" | "canceled";
		expired?: boolean;
		inviterName?: string;
	} = {},
) {
	const suffix = randomUUID().slice(0, 8);
	const inviterId = randomUUID();
	const inviterName = options.inviterName ?? "E2E Inviter";
	const orgName = `E2E Org ${suffix}`;
	await pool.query(
		`INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, true, NOW(), NOW())`,
		[inviterId, `e2e-inviter-${suffix}@example.com`, inviterName],
	);
	const org = await pool.query<{ id: string }>(
		`INSERT INTO organization (id, name, slug, "createdAt")
		 VALUES (gen_random_uuid(), $1, $2, NOW()) RETURNING id`,
		[orgName, `e2e-org-${suffix}`],
	);
	await pool.query(
		`INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
		 VALUES (gen_random_uuid(), $1, $2, 'owner', NOW())`,
		[org.rows[0].id, inviterId],
	);
	const invitation = await pool.query<{ id: string }>(
		`INSERT INTO invitation
		 (id, email, "organizationId", role, status, "inviterId", "expiresAt")
		 VALUES (gen_random_uuid(), $1, $2, 'member', $3, $4,
		         NOW() + CASE WHEN $5 THEN interval '-1 day' ELSE interval '1 day' END)
		 RETURNING id`,
		[
			email,
			org.rows[0].id,
			options.status ?? "pending",
			inviterId,
			options.expired ?? false,
		],
	);
	return {
		invitationId: invitation.rows[0].id,
		organizationId: org.rows[0].id,
		orgName,
		inviterName,
	};
}
