import type { QueryRunner } from "@/lib/org-access";
import { hasElevatedRole } from "@/lib/org-roles";

/**
 * Who may create an organization.
 *
 * Forward auth pins one organization by id, so a stray organization is not a
 * security hole in itself - but its creator becomes an *owner*, and the OIDC
 * `groups` claim lists every org a user belongs to. A downstream app keyed on
 * a slug (`groups` contains `home`) would then be fooled by anyone who could
 * create an org with that slug. Better to keep the ability to create orgs in
 * the hands of people who already run one.
 *
 * Allowed when the user is owner or admin of *some* organization, or when no
 * organization exists yet (the bootstrap case: a fresh database has nobody
 * elevated, and somebody has to make the first one). Once one org exists the
 * bootstrap door closes for everybody.
 *
 * Wired into the organization plugin's `allowUserToCreateOrganization`,
 * which the server enforces on `POST /organization/create` regardless of
 * what the UI shows.
 */
export interface OrgCreationLookup {
	/** Is this user owner or admin of any organization? */
	hasElevatedRole(userId: string): Promise<boolean>;
	/** Does any organization exist at all? */
	anyOrganizationExists(): Promise<boolean>;
}

export function createDbOrgCreationLookup(db: QueryRunner): OrgCreationLookup {
	return {
		async hasElevatedRole(userId) {
			// `role` may hold several roles comma-joined ("admin,member"), so a
			// SQL `IN` would miss them; fetch the user's roles and parse in JS.
			const result = await db.query(
				`SELECT role FROM member WHERE "userId" = $1`,
				[userId],
			);
			return result.rows.some((row) => hasElevatedRole(String(row.role)));
		},
		async anyOrganizationExists() {
			const result = await db.query(`SELECT 1 FROM organization LIMIT 1`);
			return result.rows.length > 0;
		},
	};
}

export async function canCreateOrganization(
	userId: string,
	lookup: OrgCreationLookup,
): Promise<boolean> {
	if (await lookup.hasElevatedRole(userId)) return true;
	return !(await lookup.anyOrganizationExists());
}
