/**
 * Organization slugs are embedded in the OIDC `groups` claim as
 * `<slug>:role:<role>` and `<slug>:team:<name>`. A slug containing `:` could
 * therefore spell an entry for a *different* org (`home:role:admin` as a
 * slug yields a bare group `home:role:admin`), so the character set is
 * pinned here and enforced on create and update.
 *
 * Lowercase letters, digits and hyphens: what the UI's slug generator
 * produces and what the settings page lets you type. Deliberately no
 * position rules (leading/trailing/double hyphens pass) so every slug that
 * exists today keeps working.
 */
export const ORG_SLUG_PATTERN = /^[a-z0-9-]+$/;

export function isValidOrgSlug(slug: unknown): slug is string {
	return typeof slug === "string" && ORG_SLUG_PATTERN.test(slug);
}

export const INVALID_ORG_SLUG_MESSAGE =
	"Slug may contain only lowercase letters, numbers and hyphens.";
