/**
 * `member.role` as Better Auth 1.7 stores it: one role, or several joined
 * with commas (`updateMemberRole({ role: ["admin", "member"] })` writes
 * `"admin,member"`; see `parseRoles` in the organization plugin). Every
 * reader of that column goes through here so nobody treats the joined
 * string as a single role.
 */

/** Roles that count as elevated: they satisfy `role=admin` and bypass `team=`. */
export const ELEVATED_ROLES: ReadonlySet<string> = new Set(["owner", "admin"]);

/** Split a stored role value into its roles, trimmed, empties dropped. */
export function parseMemberRoles(role: string | null | undefined): string[] {
	if (typeof role !== "string") return [];
	return role
		.split(",")
		.map((r) => r.trim())
		.filter((r) => r.length > 0);
}

/** True when any of the stored roles is owner or admin. */
export function hasElevatedRole(role: string | null | undefined): boolean {
	return parseMemberRoles(role).some((r) => ELEVATED_ROLES.has(r));
}
