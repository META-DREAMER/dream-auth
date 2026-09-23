import type { QueryRunner } from "@/lib/org-access";

/**
 * The OIDC `groups` claim, for RBAC in downstream apps (ArgoCD, Grafana,
 * Immich, ...). Emitted on both the ID token and UserInfo, and only when the
 * `groups` scope was granted.
 *
 * Three kinds of entry, for every organization the user belongs to:
 *
 * - `<slug>` - the original form, kept first and unchanged so existing role
 *   mappings keep working.
 * - `<slug>:role:<role>` - the user's org role (`owner`, `admin`, `member`).
 * - `<slug>:team:<name>` - one per team the user is in, raw team name.
 *
 * A downstream app that wants "admins of home" maps `home:role:admin`; one
 * that wants "the media team" maps `home:team:media`. The bare slug is the
 * coarse "is a member" group it always was.
 */
export interface GroupsMembershipRow {
	slug: string;
	role: string;
	/** `null` when the user is in none of the org's teams. */
	teamName: string | null;
}

export interface GroupsLookup {
	listMemberships(userId: string): Promise<GroupsMembershipRow[]>;
}

export function createDbGroupsLookup(db: QueryRunner): GroupsLookup {
	return {
		async listMemberships(userId) {
			// The parenthesised join pairs each team with the user's row in it
			// *before* the outer join, so an org with teams the user is not in
			// still yields exactly one row with a null team, and teams from other
			// orgs never leak across.
			const result = await db.query(
				`SELECT o.slug, m.role, t.name AS "teamName"
				 FROM member m
				 JOIN organization o ON o.id = m."organizationId"
				 LEFT JOIN (team t JOIN "teamMember" tm ON tm."teamId" = t.id)
				   ON t."organizationId" = o.id AND tm."userId" = m."userId"
				 WHERE m."userId" = $1
				 ORDER BY o.slug, t.name`,
				[userId],
			);
			return result.rows.map((row) => ({
				slug: String(row.slug),
				role: String(row.role),
				teamName: typeof row.teamName === "string" ? row.teamName : null,
			}));
		},
	};
}

/** Pure: rows in, ordered and de-duplicated group list out. */
export function buildGroupsClaim(rows: GroupsMembershipRow[]): string[] {
	const slugs = new Set<string>();
	const roles = new Set<string>();
	const teams = new Set<string>();
	for (const row of rows) {
		slugs.add(row.slug);
		roles.add(`${row.slug}:role:${row.role}`);
		if (row.teamName !== null) teams.add(`${row.slug}:team:${row.teamName}`);
	}
	return [...slugs, ...roles, ...teams];
}

export async function getGroupsClaim(
	userId: string,
	scopes: readonly string[],
	lookup: GroupsLookup,
): Promise<Record<string, unknown>> {
	if (!scopes.includes("groups")) return {};
	return { groups: buildGroupsClaim(await lookup.listMemberships(userId)) };
}
