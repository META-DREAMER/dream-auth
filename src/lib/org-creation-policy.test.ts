import { describe, expect, it } from "vitest";
import {
	canCreateOrganization,
	type OrgCreationLookup,
} from "./org-creation-policy";

function lookup(state: {
	elevated: string[];
	anyOrg: boolean;
}): OrgCreationLookup {
	return {
		async hasElevatedRole(userId) {
			return state.elevated.includes(userId);
		},
		async anyOrganizationExists() {
			return state.anyOrg;
		},
	};
}

describe("canCreateOrganization", () => {
	it("allows an owner or admin of some organization", async () => {
		const db = lookup({ elevated: ["owner-1"], anyOrg: true });
		expect(await canCreateOrganization("owner-1", db)).toBe(true);
	});

	it("blocks a plain member once any organization exists", async () => {
		const db = lookup({ elevated: ["owner-1"], anyOrg: true });
		expect(await canCreateOrganization("member-1", db)).toBe(false);
	});

	it("blocks a user with no organization once any organization exists", async () => {
		const db = lookup({ elevated: [], anyOrg: true });
		expect(await canCreateOrganization("newcomer", db)).toBe(false);
	});

	it("allows the very first organization on a fresh database", async () => {
		const db = lookup({ elevated: [], anyOrg: false });
		expect(await canCreateOrganization("first-user", db)).toBe(true);
	});
});
