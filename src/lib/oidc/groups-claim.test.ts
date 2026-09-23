import { describe, expect, it, vi } from "vitest";
import {
	buildGroupsClaim,
	type GroupsLookup,
	type GroupsMembershipRow,
	getGroupsClaim,
} from "./groups-claim";

const rows: GroupsMembershipRow[] = [
	{ slug: "home", role: "member", teamName: "media" },
	{ slug: "home", role: "member", teamName: "ops" },
	{ slug: "lab", role: "owner", teamName: null },
];

describe("buildGroupsClaim", () => {
	it("keeps the bare slugs first, exactly as before", () => {
		const groups = buildGroupsClaim(rows);
		expect(groups.slice(0, 2)).toEqual(["home", "lab"]);
	});

	it("adds one role entry per org and one team entry per team", () => {
		expect(buildGroupsClaim(rows)).toEqual([
			"home",
			"lab",
			"home:role:member",
			"lab:role:owner",
			"home:team:media",
			"home:team:ops",
		]);
	});

	it("emits no team entry for an org the user has no teams in", () => {
		expect(
			buildGroupsClaim([{ slug: "lab", role: "admin", teamName: null }]),
		).toEqual(["lab", "lab:role:admin"]);
	});

	it("is empty for a user in no organization", () => {
		expect(buildGroupsClaim([])).toEqual([]);
	});

	it("de-duplicates repeated rows", () => {
		expect(
			buildGroupsClaim([
				{ slug: "home", role: "member", teamName: "media" },
				{ slug: "home", role: "member", teamName: "media" },
			]),
		).toEqual(["home", "home:role:member", "home:team:media"]);
	});
});

describe("getGroupsClaim", () => {
	const lookup: GroupsLookup = {
		listMemberships: vi.fn(async () => rows),
	};

	it("returns nothing when the groups scope was not granted", async () => {
		expect(await getGroupsClaim("u1", ["openid", "profile"], lookup)).toEqual(
			{},
		);
	});

	it("returns the groups claim when the scope was granted", async () => {
		expect(await getGroupsClaim("u1", ["openid", "groups"], lookup)).toEqual({
			groups: [
				"home",
				"lab",
				"home:role:member",
				"lab:role:owner",
				"home:team:media",
				"home:team:ops",
			],
		});
		expect(lookup.listMemberships).toHaveBeenCalledWith("u1");
	});
});
