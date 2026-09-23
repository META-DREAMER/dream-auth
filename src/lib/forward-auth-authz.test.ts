import { describe, expect, it, vi } from "vitest";
import {
	authorize,
	buildGroups,
	createCachedOrgAccessLookup,
	logForwardAuthAuthzWarnings,
	type OrgAccess,
	type OrgAccessLookup,
	parseAuthzRequirement,
} from "./forward-auth-authz";

const VERIFY = "http://dream-auth.auth.svc.cluster.local:3000/api/verify";

const owner: OrgAccess = {
	role: "owner",
	teams: [{ name: "media", isMember: false }],
};
const admin: OrgAccess = {
	role: "admin",
	teams: [{ name: "media", isMember: false }],
};
const memberInTeam: OrgAccess = {
	role: "member",
	teams: [
		{ name: "media", isMember: true },
		{ name: "ops", isMember: false },
	],
};
const memberNotInTeam: OrgAccess = {
	role: "member",
	teams: [{ name: "media", isMember: false }],
};
const nonMember = null;

describe("parseAuthzRequirement", () => {
	it("is a plain membership check with no parameters", () => {
		expect(parseAuthzRequirement(new URL(VERIFY))).toEqual({ kind: "member" });
		expect(parseAuthzRequirement(new URL(`${VERIFY}?mode=redirect`))).toEqual({
			kind: "member",
		});
	});

	it("reads role=admin", () => {
		expect(
			parseAuthzRequirement(new URL(`${VERIFY}?mode=redirect&role=admin`)),
		).toEqual({ kind: "role", role: "admin" });
	});

	it("reads team=<name>, trimmed but otherwise verbatim", () => {
		expect(parseAuthzRequirement(new URL(`${VERIFY}?team=media`))).toEqual({
			kind: "team",
			team: "media",
		});
		expect(
			parseAuthzRequirement(new URL(`${VERIFY}?team=%20Media%20`)),
		).toEqual({ kind: "team", team: "Media" });
	});

	it.each([
		"role=owner",
		"role=member",
		"role=",
		"role=Admin",
	])("rejects any role requirement other than admin: %s", (query) => {
		const requirement = parseAuthzRequirement(new URL(`${VERIFY}?${query}`));
		expect(requirement.kind).toBe("invalid");
	});

	it("rejects an empty team", () => {
		expect(parseAuthzRequirement(new URL(`${VERIFY}?team=`)).kind).toBe(
			"invalid",
		);
		expect(parseAuthzRequirement(new URL(`${VERIFY}?team=%20`)).kind).toBe(
			"invalid",
		);
	});

	it("rejects role and team together", () => {
		expect(
			parseAuthzRequirement(new URL(`${VERIFY}?team=media&role=admin`)).kind,
		).toBe("invalid");
	});
});

describe("authorize", () => {
	describe("no requirement (any member)", () => {
		const requirement = { kind: "member" } as const;

		it.each([
			["owner", owner],
			["admin", admin],
			["member in team", memberInTeam],
			["member not in team", memberNotInTeam],
		])("allows %s", (_label, access) => {
			expect(authorize(access, requirement).allowed).toBe(true);
		});

		it("denies a non-member", () => {
			expect(authorize(nonMember, requirement)).toEqual({
				allowed: false,
				reason: expect.stringContaining("not a member"),
			});
		});
	});

	describe("role=admin", () => {
		const requirement = { kind: "role", role: "admin" } as const;

		it("allows owner and admin", () => {
			expect(authorize(owner, requirement).allowed).toBe(true);
			expect(authorize(admin, requirement).allowed).toBe(true);
		});

		it("denies a member, in a team or not", () => {
			expect(authorize(memberInTeam, requirement).allowed).toBe(false);
			expect(authorize(memberNotInTeam, requirement).allowed).toBe(false);
		});

		it("denies a non-member", () => {
			expect(authorize(nonMember, requirement).allowed).toBe(false);
		});
	});

	describe("team=media", () => {
		const requirement = { kind: "team", team: "media" } as const;

		it("allows owner and admin without team membership", () => {
			expect(authorize(owner, requirement).allowed).toBe(true);
			expect(authorize(admin, requirement).allowed).toBe(true);
		});

		it("allows a member of the team", () => {
			expect(authorize(memberInTeam, requirement).allowed).toBe(true);
		});

		it("denies a member who is not in the team", () => {
			expect(authorize(memberNotInTeam, requirement)).toEqual({
				allowed: false,
				reason: expect.stringContaining('not a member of team "media"'),
			});
		});

		it("denies a non-member", () => {
			expect(authorize(nonMember, requirement).allowed).toBe(false);
		});

		it("matches the team name case-insensitively", () => {
			expect(
				authorize(memberInTeam, { kind: "team", team: "MEDIA" }).allowed,
			).toBe(true);
			expect(
				authorize(
					{ role: "member", teams: [{ name: "Media Team", isMember: true }] },
					{ kind: "team", team: "media team" },
				).allowed,
			).toBe(true);
		});

		it("matches exactly, not by prefix or substring", () => {
			expect(
				authorize(memberInTeam, { kind: "team", team: "med" }).allowed,
			).toBe(false);
			expect(
				authorize(memberInTeam, { kind: "team", team: "media-admins" }).allowed,
			).toBe(false);
		});

		it("denies an unknown team for a member, naming it", () => {
			const decision = authorize(memberInTeam, {
				kind: "team",
				team: "photos",
			});
			expect(decision).toEqual({
				allowed: false,
				reason: expect.stringContaining('"photos" does not exist'),
			});
		});

		it("still allows owner and admin through an unknown team", () => {
			// Elevated roles are checked first: an admin is never locked out of
			// an app by a middleware typo, which keeps the fix reachable.
			expect(authorize(owner, { kind: "team", team: "photos" }).allowed).toBe(
				true,
			);
		});
	});

	it("denies an invalid requirement regardless of who asks", () => {
		const requirement = { kind: "invalid", reason: "bad" } as const;
		expect(authorize(owner, requirement)).toEqual({
			allowed: false,
			reason: "bad",
		});
		expect(authorize(nonMember, requirement).allowed).toBe(false);
	});

	it("returns the groups on every allow", () => {
		const decision = authorize(memberInTeam, { kind: "member" });
		expect(decision).toEqual({
			allowed: true,
			groups: ["role:member", "team:media"],
		});
	});
});

describe("buildGroups", () => {
	it("lists the role and only the teams the user is in", () => {
		expect(buildGroups(memberInTeam)).toEqual(["role:member", "team:media"]);
		expect(buildGroups(owner)).toEqual(["role:owner"]);
		expect(
			buildGroups({
				role: "member",
				teams: [
					{ name: "a", isMember: true },
					{ name: "b", isMember: true },
				],
			}),
		).toEqual(["role:member", "team:a", "team:b"]);
	});
});

describe("createCachedOrgAccessLookup", () => {
	function fakeLookup(): OrgAccessLookup & { calls: number } {
		const lookup = {
			calls: 0,
			async getOrgAccess(userId: string) {
				lookup.calls += 1;
				return userId === "nobody" ? null : memberInTeam;
			},
		};
		return lookup;
	}

	it("serves repeated lookups from the cache within the TTL", async () => {
		let clock = 1_000;
		const inner = fakeLookup();
		const cached = createCachedOrgAccessLookup(inner, {
			ttlMs: 30_000,
			now: () => clock,
		});

		await cached.getOrgAccess("u1", "org");
		clock += 29_999;
		const hit = await cached.getOrgAccess("u1", "org");

		expect(hit).toEqual(memberInTeam);
		expect(inner.calls).toBe(1);
	});

	it("re-queries once the TTL has passed", async () => {
		let clock = 1_000;
		const inner = fakeLookup();
		const cached = createCachedOrgAccessLookup(inner, {
			ttlMs: 30_000,
			now: () => clock,
		});

		await cached.getOrgAccess("u1", "org");
		clock += 30_000;
		await cached.getOrgAccess("u1", "org");

		expect(inner.calls).toBe(2);
	});

	it("keys on both user and org", async () => {
		const inner = fakeLookup();
		const cached = createCachedOrgAccessLookup(inner, { now: () => 0 });

		await cached.getOrgAccess("u1", "org-a");
		await cached.getOrgAccess("u1", "org-b");
		await cached.getOrgAccess("u2", "org-a");

		expect(inner.calls).toBe(3);
	});

	it("caches a non-member result too", async () => {
		const inner = fakeLookup();
		const cached = createCachedOrgAccessLookup(inner, { now: () => 0 });

		expect(await cached.getOrgAccess("nobody", "org")).toBeNull();
		expect(await cached.getOrgAccess("nobody", "org")).toBeNull();
		expect(inner.calls).toBe(1);
	});

	it("never caches a failure", async () => {
		let fail = true;
		const inner: OrgAccessLookup = {
			async getOrgAccess() {
				if (fail) throw new Error("down");
				return owner;
			},
		};
		const cached = createCachedOrgAccessLookup(inner, { now: () => 0 });

		await expect(cached.getOrgAccess("u1", "org")).rejects.toThrow("down");
		fail = false;
		expect(await cached.getOrgAccess("u1", "org")).toEqual(owner);
	});

	it("forgets everything on clear()", async () => {
		const inner = fakeLookup();
		const cached = createCachedOrgAccessLookup(inner, { now: () => 0 });

		await cached.getOrgAccess("u1", "org");
		cached.clear();
		await cached.getOrgAccess("u1", "org");

		expect(inner.calls).toBe(2);
	});
});

describe("logForwardAuthAuthzWarnings", () => {
	it("warns when FORWARD_AUTH_ORG_ID is unset", () => {
		const log = vi.fn();
		logForwardAuthAuthzWarnings({ orgId: undefined }, log);
		expect(log).toHaveBeenCalledTimes(1);
		expect(log.mock.calls[0][0]).toContain("FORWARD_AUTH_ORG_ID is not set");
		expect(log.mock.calls[0][0]).toContain("every signed-in user");
	});

	it("is silent when it is set", () => {
		const log = vi.fn();
		logForwardAuthAuthzWarnings({ orgId: "org_123" }, log);
		expect(log).not.toHaveBeenCalled();
	});
});
