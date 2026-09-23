import { describe, expect, it } from "vitest";
import { hasElevatedRole, parseMemberRoles } from "./org-roles";

describe("parseMemberRoles", () => {
	it("returns a single role as a one-element list", () => {
		expect(parseMemberRoles("member")).toEqual(["member"]);
	});

	it("splits the comma-joined form Better Auth 1.7 stores", () => {
		expect(parseMemberRoles("admin,member")).toEqual(["admin", "member"]);
	});

	it("trims and drops empty entries", () => {
		expect(parseMemberRoles(" admin , member ,")).toEqual(["admin", "member"]);
		expect(parseMemberRoles(",,")).toEqual([]);
	});

	it("is empty for a missing value", () => {
		expect(parseMemberRoles(null)).toEqual([]);
		expect(parseMemberRoles(undefined)).toEqual([]);
		expect(parseMemberRoles("")).toEqual([]);
	});
});

describe("hasElevatedRole", () => {
	it.each([
		"owner",
		"admin",
		"admin,member",
		"member,owner",
		" member , admin ",
	])("is true when owner or admin is among the roles: %j", (role) => {
		expect(hasElevatedRole(role)).toBe(true);
	});

	it.each([
		"member",
		"member,viewer",
		"",
		"administrator",
		"owners",
	])("is false otherwise: %j", (role) => {
		expect(hasElevatedRole(role)).toBe(false);
	});
});
