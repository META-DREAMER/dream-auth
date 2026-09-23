import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import {
	canCreateOrganization,
	createDbOrgCreationLookup,
} from "@/lib/org-creation-policy";

const lookup = createDbOrgCreationLookup(pool);

/**
 * Whether the current user may create an organization. Drives the visibility
 * of the "Create Organization" entry; the server enforces the same rule on
 * the create endpoint, so this is a courtesy, not the gate.
 */
export const canCreateOrganizationFn = createServerFn({
	method: "GET",
}).handler(async (): Promise<boolean> => {
	const session = await auth.api.getSession({ headers: getRequestHeaders() });
	if (!session?.user) return false;
	return canCreateOrganization(session.user.id, lookup);
});
