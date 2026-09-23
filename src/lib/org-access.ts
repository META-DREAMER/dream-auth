import { serverEnv } from "@/env";
import { pool } from "@/lib/db";
import {
	createCachedOrgAccessLookup,
	type OrgAccess,
	type OrgAccessLookup,
} from "@/lib/forward-auth-authz";

/** The minimal query surface the lookups need; a `pg.Pool` satisfies it. */
export interface QueryRunner {
	query(
		text: string,
		values?: unknown[],
	): Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * Live lookup against Better Auth's organization tables.
 *
 * One query, all indexed: `member(userId)` and `member(organizationId)`
 * narrow to the single membership row, `team(organizationId)` fans out to
 * the org's teams, and `teamMember(teamId, userId)` marks the ones the user
 * is in. Zero rows means "not a member"; an org with no teams still yields
 * one row with a null team.
 *
 * Team membership is read from `teamMember`, the table the 1.7 plugin's
 * `addTeamMember` writes to. The legacy `member.teamId` column is ignored.
 */
export function createDbOrgAccessLookup(db: QueryRunner): OrgAccessLookup {
	return {
		async getOrgAccess(userId, orgId) {
			const result = await db.query(
				`SELECT m.role, t.name AS "teamName", (tm."userId" IS NOT NULL) AS "isMember"
				 FROM member m
				 LEFT JOIN team t ON t."organizationId" = m."organizationId"
				 LEFT JOIN "teamMember" tm ON tm."teamId" = t.id AND tm."userId" = m."userId"
				 WHERE m."userId" = $1 AND m."organizationId" = $2`,
				[userId, orgId],
			);
			if (result.rows.length === 0) return null;

			const role = String(result.rows[0].role);
			const teams = new Map<string, boolean>();
			for (const row of result.rows) {
				if (typeof row.teamName !== "string") continue;
				teams.set(
					row.teamName,
					(teams.get(row.teamName) ?? false) || row.isMember === true,
				);
			}

			const access: OrgAccess = {
				role,
				teams: [...teams].map(([name, isMember]) => ({ name, isMember })),
			};
			return access;
		},
	};
}

/**
 * The lookup `/api/verify` uses: the database, behind the 30-second cache
 * described in `createCachedOrgAccessLookup`.
 */
export const orgAccessLookup = createCachedOrgAccessLookup(
	createDbOrgAccessLookup(pool),
);

/**
 * The organization whose membership authorizes forward-auth requests, or
 * `undefined` for the legacy allow-any-signed-in-user behaviour.
 */
export function getForwardAuthOrgId(): string | undefined {
	return serverEnv.FORWARD_AUTH_ORG_ID;
}
