import { APIError } from "better-auth/api";
import type { QueryRunner } from "@/lib/org-access";
import {
	canCreateOrganization,
	createDbOrgCreationLookup,
} from "@/lib/org-creation-policy";
import { INVALID_ORG_SLUG_MESSAGE, isValidOrgSlug } from "@/lib/org-slug";

/**
 * The organization-plugin options that encode policy, as one object so the
 * production config (`src/lib/auth.ts`) and the integration tests
 * (`src/lib/org-access.int.test.ts`) run the very same wiring against
 * whichever database they are given.
 *
 * - `allowUserToCreateOrganization`: see `src/lib/org-creation-policy.ts`.
 * - `beforeCreateOrganization` / `beforeUpdateOrganization`: reject a slug
 *   outside `[a-z0-9-]`, see `src/lib/org-slug.ts`. On update the slug is
 *   only checked when it is being changed.
 */
export function createOrganizationPolicy(db: QueryRunner) {
	const creationLookup = createDbOrgCreationLookup(db);

	const rejectInvalidSlug = (organization: { slug?: string }) => {
		if (organization.slug === undefined) return;
		if (!isValidOrgSlug(organization.slug)) {
			throw new APIError("BAD_REQUEST", {
				message: INVALID_ORG_SLUG_MESSAGE,
				code: "INVALID_ORGANIZATION_SLUG",
			});
		}
	};

	return {
		allowUserToCreateOrganization: (user: { id: string }) =>
			canCreateOrganization(user.id, creationLookup),
		organizationHooks: {
			beforeCreateOrganization: async ({
				organization,
			}: {
				organization: { slug?: string };
			}) => {
				rejectInvalidSlug(organization);
			},
			beforeUpdateOrganization: async ({
				organization,
			}: {
				organization: { slug?: string };
			}) => {
				rejectInvalidSlug(organization);
			},
		},
	};
}
