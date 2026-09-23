/**
 * Integration tests for the forward-auth membership lookup, the OIDC groups
 * lookup and the org-creation policy, against a real PostgreSQL database
 * (testcontainers) whose schema a real Better Auth instance migrated.
 *
 * The rows are written through the organization plugin's own API - sign-up,
 * create org, create team, add member, add team member - so these tests
 * pin the hand-written SQL to the tables the 1.7 plugin actually writes
 * (`member`, `team`, `teamMember`), not to a fixture that can drift.
 *
 * Run with: pnpm test:integration
 */

import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { organization } from "better-auth/plugins";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDbGroupsLookup } from "./oidc/groups-claim";
import { createDbOrgAccessLookup } from "./org-access";
import { createDbOrgCreationLookup } from "./org-creation-policy";
import { createOrganizationPolicy } from "./org-policy";

const skipIfNoDb = !process.env.INTEGRATION_TEST_DB_READY;

/** A signed-in principal: the id and the cookie that authenticates as it. */
interface Principal {
	userId: string;
	headers: Headers;
}

/**
 * A Better Auth instance with the same organization configuration as
 * `src/lib/auth.ts` where it matters here: teams on, and the *same* policy
 * object production spreads in (`createOrganizationPolicy`: who may create
 * an org, and slug validation on create/update). Kept as a function so
 * `testAuth` keeps the plugin's inferred `api` surface.
 */
function createTestAuth(pool: Pool) {
	const policy = createOrganizationPolicy(pool);
	return betterAuth({
		database: pool,
		baseURL: "http://localhost:3000",
		secret: "integration-test-secret-at-least-32-characters",
		emailAndPassword: { enabled: true },
		plugins: [
			organization({
				teams: { enabled: true },
				allowUserToCreateOrganization: policy.allowUserToCreateOrganization,
				organizationHooks: policy.organizationHooks,
			}),
		],
	});
}

describe("forward-auth authorization (integration)", () => {
	let pool: Pool;
	let testAuth: ReturnType<typeof createTestAuth>;

	beforeAll(async () => {
		if (skipIfNoDb) return;

		pool = new Pool({ connectionString: process.env.DATABASE_URL });
		testAuth = createTestAuth(pool);

		const migrations = await getMigrations(testAuth.options);
		await migrations.runMigrations();
	}, 120_000);

	afterAll(async () => {
		if (skipIfNoDb) return;
		await pool?.end();
	});

	beforeEach(async () => {
		if (skipIfNoDb) return;
		for (const table of [
			"teamMember",
			"team",
			"invitation",
			"member",
			"organization",
			"session",
			"account",
			"user",
		]) {
			await pool.query(`TRUNCATE TABLE "${table}" CASCADE`);
		}
	});

	async function signUp(name: string): Promise<Principal> {
		const response = await testAuth.api.signUpEmail({
			body: {
				name,
				email: `${name}@example.com`,
				password: "correct horse battery staple",
			},
			asResponse: true,
		});
		expect(response.ok).toBe(true);
		const body = (await response.json()) as { user: { id: string } };

		const setCookie = response.headers.get("set-cookie") ?? "";
		const token = /better-auth\.session_token=([^;]+)/.exec(setCookie)?.[1];
		if (!token) throw new Error(`no session cookie for ${name}: ${setCookie}`);

		return {
			userId: body.user.id,
			headers: new Headers({ cookie: `better-auth.session_token=${token}` }),
		};
	}

	async function createOrg(
		owner: Principal,
		slug: string,
	): Promise<{ id: string; slug: string }> {
		const org = await testAuth.api.createOrganization({
			body: { name: slug, slug },
			headers: owner.headers,
		});
		if (!org) throw new Error("createOrganization returned nothing");
		return { id: org.id, slug: org.slug };
	}

	async function addMember(
		orgId: string,
		user: Principal,
		role: "admin" | "member",
	) {
		await testAuth.api.addMember({
			body: { userId: user.userId, organizationId: orgId, role },
		});
	}

	async function createTeam(
		owner: Principal,
		orgId: string,
		name: string,
	): Promise<string> {
		const team = await testAuth.api.createTeam({
			body: { name, organizationId: orgId },
			headers: owner.headers,
		});
		return team.id;
	}

	async function addTeamMember(
		owner: Principal,
		orgId: string,
		teamId: string,
		user: Principal,
	) {
		await testAuth.api.addTeamMember({
			body: { teamId, userId: user.userId, organizationId: orgId },
			headers: owner.headers,
		});
	}

	/** Give `user` several roles in the home org, the way the members page does. */
	async function setRoles(
		f: { owner: Principal; home: { id: string } },
		user: Principal,
		roles: string[],
	) {
		const member = await pool.query(
			`SELECT id FROM member WHERE "userId" = $1 AND "organizationId" = $2`,
			[user.userId, f.home.id],
		);
		await testAuth.api.updateMemberRole({
			body: {
				memberId: String(member.rows[0]?.id),
				organizationId: f.home.id,
				role: roles,
			},
			headers: f.owner.headers,
		});
	}

	/**
	 * The fixture every test below shares: the "home" org with an owner, an
	 * admin, a member in the Media team and a member in no team; "Media" and
	 * "ops" teams (plus the plugin's default team, named "home"); and a second
	 * org whose owner is a stranger to the pinned one.
	 */
	async function seed() {
		const owner = await signUp("owner");
		const admin = await signUp("admin");
		const inTeam = await signUp("in-team");
		const notInTeam = await signUp("not-in-team");
		const stranger = await signUp("stranger");

		// Bootstrap: no org exists, so the first user may create one.
		const home = await createOrg(owner, "home");
		await addMember(home.id, admin, "admin");
		await addMember(home.id, inTeam, "member");
		await addMember(home.id, notInTeam, "member");

		const mediaTeamId = await createTeam(owner, home.id, "Media");
		await createTeam(owner, home.id, "ops");
		await addTeamMember(owner, home.id, mediaTeamId, inTeam);

		// The stranger owns a different org. Created through the system path
		// (no session, explicit userId) since the policy would refuse them.
		const other = await testAuth.api.createOrganization({
			body: { name: "Other", slug: "other-home", userId: stranger.userId },
		});
		if (!other) throw new Error("second org not created");

		return {
			owner,
			admin,
			inTeam,
			notInTeam,
			stranger,
			home,
			other: { id: other.id, slug: other.slug },
		};
	}

	describe("createDbOrgAccessLookup", () => {
		it.skipIf(skipIfNoDb)(
			"returns role and every team, flagged by membership",
			async () => {
				const f = await seed();
				const lookup = createDbOrgAccessLookup(pool);

				expect(await lookup.getOrgAccess(f.owner.userId, f.home.id)).toEqual({
					role: "owner",
					teams: expect.arrayContaining([
						{ name: "Media", isMember: false },
						{ name: "ops", isMember: false },
					]),
				});
				expect(await lookup.getOrgAccess(f.admin.userId, f.home.id)).toEqual(
					expect.objectContaining({ role: "admin" }),
				);

				const member = await lookup.getOrgAccess(f.inTeam.userId, f.home.id);
				expect(member?.role).toBe("member");
				// Three teams: the two created here plus the default team the 1.7
				// plugin creates with the org, named after it, with only the
				// creator in it. `team=home` would therefore mean "the owner".
				expect(member?.teams).toHaveLength(3);
				expect(member?.teams).toEqual(
					expect.arrayContaining([
						{ name: "home", isMember: false },
						{ name: "Media", isMember: true },
						{ name: "ops", isMember: false },
					]),
				);

				const outsider = await lookup.getOrgAccess(
					f.notInTeam.userId,
					f.home.id,
				);
				expect(outsider?.role).toBe("member");
				expect(outsider?.teams.every((t) => !t.isMember)).toBe(true);
			},
		);

		it.skipIf(skipIfNoDb)("returns null for a non-member", async () => {
			const f = await seed();
			const lookup = createDbOrgAccessLookup(pool);
			expect(
				await lookup.getOrgAccess(f.stranger.userId, f.home.id),
			).toBeNull();
		});

		it.skipIf(skipIfNoDb)(
			"keys on the org id: owning another org grants nothing here",
			async () => {
				const f = await seed();
				const lookup = createDbOrgAccessLookup(pool);

				// The stranger is an owner - of the other org (and in its default
				// team, which the plugin names after the org).
				expect(
					await lookup.getOrgAccess(f.stranger.userId, f.other.id),
				).toEqual({
					role: "owner",
					teams: [{ name: "Other", isMember: true }],
				});
				// Renaming that org's slug to "home" would be the attack; slugs
				// are unique so we cannot literally collide, but the lookup never
				// reads the slug at all: only the pinned id matters.
				await pool
					.query(`UPDATE organization SET slug = 'home' WHERE id = $1`, [
						f.other.id,
					])
					.catch(() => {
						// Unique violation is fine; the assertion below is the point.
					});
				expect(
					await lookup.getOrgAccess(f.stranger.userId, f.home.id),
				).toBeNull();
			},
		);

		it.skipIf(skipIfNoDb)(
			"returns an empty team list for an org with no teams",
			async () => {
				const f = await seed();
				// Drop the plugin's default team so the org genuinely has none.
				await pool.query(`DELETE FROM team WHERE "organizationId" = $1`, [
					f.other.id,
				]);
				const lookup = createDbOrgAccessLookup(pool);
				expect(
					await lookup.getOrgAccess(f.stranger.userId, f.other.id),
				).toEqual({ role: "owner", teams: [] });
			},
		);
	});

	describe("createDbGroupsLookup (OIDC groups claim)", () => {
		it.skipIf(skipIfNoDb)(
			"lists slug, role and team per organization",
			async () => {
				const f = await seed();
				// Put the in-team member in the other org as well, to prove teams
				// never leak across organizations.
				await addMember(f.other.id, f.inTeam, "admin");

				const lookup = createDbGroupsLookup(pool);
				const rows = await lookup.listMemberships(f.inTeam.userId);

				expect(rows).toEqual([
					{ slug: "home", role: "member", teamName: "Media" },
					{ slug: "other-home", role: "admin", teamName: null },
				]);
			},
		);

		it.skipIf(skipIfNoDb)(
			"yields one row with no team for a member of no team",
			async () => {
				const f = await seed();
				const lookup = createDbGroupsLookup(pool);
				expect(await lookup.listMemberships(f.notInTeam.userId)).toEqual([
					{ slug: "home", role: "member", teamName: null },
				]);
			},
		);

		it.skipIf(skipIfNoDb)("is empty for a user in no org", async () => {
			await seed();
			const nobody = await signUp("nobody");
			const lookup = createDbGroupsLookup(pool);
			expect(await lookup.listMemberships(nobody.userId)).toEqual([]);
		});
	});

	describe("organization creation policy", () => {
		it.skipIf(skipIfNoDb)(
			"blocks a plain member from creating an organization",
			async () => {
				const f = await seed();

				await expect(
					testAuth.api.createOrganization({
						body: { name: "Mine", slug: "home-mine" },
						headers: f.notInTeam.headers,
					}),
				).rejects.toMatchObject({ status: "FORBIDDEN" });

				const rows = await pool.query(
					`SELECT 1 FROM organization WHERE slug = 'home-mine'`,
				);
				expect(rows.rows).toHaveLength(0);
			},
		);

		it.skipIf(skipIfNoDb)(
			"blocks a user with no organization once one exists",
			async () => {
				await seed();
				const newcomer = await signUp("newcomer");

				await expect(
					testAuth.api.createOrganization({
						body: { name: "Home", slug: "home-fake" },
						headers: newcomer.headers,
					}),
				).rejects.toMatchObject({ status: "FORBIDDEN" });
			},
		);

		it.skipIf(skipIfNoDb)("lets an owner or admin create another", async () => {
			const f = await seed();

			const byOwner = await testAuth.api.createOrganization({
				body: { name: "Second", slug: "second" },
				headers: f.owner.headers,
			});
			expect(byOwner?.slug).toBe("second");

			const byAdmin = await testAuth.api.createOrganization({
				body: { name: "Third", slug: "third" },
				headers: f.admin.headers,
			});
			expect(byAdmin?.slug).toBe("third");
		});

		it.skipIf(skipIfNoDb)(
			"counts a multi-role member with admin among the roles as elevated",
			async () => {
				const f = await seed();
				await setRoles(f, f.notInTeam, ["admin", "member"]);

				const lookup = createDbOrgCreationLookup(pool);
				expect(await lookup.hasElevatedRole(f.notInTeam.userId)).toBe(true);
				expect(await lookup.hasElevatedRole(f.inTeam.userId)).toBe(false);

				const org = await testAuth.api.createOrganization({
					body: { name: "Mine", slug: "mine" },
					headers: f.notInTeam.headers,
				});
				expect(org?.slug).toBe("mine");
			},
		);
	});

	describe("slug validation (org-policy hooks)", () => {
		it.skipIf(skipIfNoDb)("rejects a slug with a colon on create", async () => {
			const f = await seed();
			await expect(
				testAuth.api.createOrganization({
					body: { name: "Forged", slug: "home:role:admin" },
					headers: f.owner.headers,
				}),
			).rejects.toMatchObject({ status: "BAD_REQUEST" });
			const rows = await pool.query(
				`SELECT 1 FROM organization WHERE slug LIKE '%:%'`,
			);
			expect(rows.rows).toHaveLength(0);
		});

		it.skipIf(skipIfNoDb)(
			"rejects a slug with a colon on update, and keeps the old one",
			async () => {
				const f = await seed();
				await expect(
					testAuth.api.updateOrganization({
						body: {
							organizationId: f.home.id,
							data: { slug: "home:team:media" },
						},
						headers: f.owner.headers,
					}),
				).rejects.toMatchObject({ status: "BAD_REQUEST" });
				const rows = await pool.query(
					`SELECT slug FROM organization WHERE id = $1`,
					[f.home.id],
				);
				expect(rows.rows[0]?.slug).toBe("home");
			},
		);

		it.skipIf(skipIfNoDb)(
			"accepts ordinary slugs on create and update",
			async () => {
				const f = await seed();
				const created = await testAuth.api.createOrganization({
					body: { name: "Lab 2", slug: "lab-2" },
					headers: f.owner.headers,
				});
				expect(created?.slug).toBe("lab-2");

				const updated = await testAuth.api.updateOrganization({
					body: { organizationId: f.home.id, data: { slug: "home-1" } },
					headers: f.owner.headers,
				});
				expect(updated?.slug).toBe("home-1");

				// A name-only update leaves the slug alone and passes.
				const renamed = await testAuth.api.updateOrganization({
					body: { organizationId: f.home.id, data: { name: "Home!" } },
					headers: f.owner.headers,
				});
				expect(renamed?.name).toBe("Home!");
			},
		);
	});

	describe('multi-role members (role stored as "admin,member")', () => {
		it.skipIf(skipIfNoDb)(
			"is stored comma-joined and read back as such",
			async () => {
				const f = await seed();
				await setRoles(f, f.notInTeam, ["admin", "member"]);

				const stored = await pool.query(
					`SELECT role FROM member WHERE "userId" = $1 AND "organizationId" = $2`,
					[f.notInTeam.userId, f.home.id],
				);
				expect(stored.rows[0]?.role).toBe("admin,member");

				const access = await createDbOrgAccessLookup(pool).getOrgAccess(
					f.notInTeam.userId,
					f.home.id,
				);
				expect(access?.role).toBe("admin,member");
			},
		);

		it.skipIf(skipIfNoDb)(
			"yields one row per org with the joined role, for the groups claim",
			async () => {
				const f = await seed();
				await setRoles(f, f.notInTeam, ["admin", "member"]);

				const rows = await createDbGroupsLookup(pool).listMemberships(
					f.notInTeam.userId,
				);
				expect(rows).toEqual([
					{ slug: "home", role: "admin,member", teamName: null },
				]);
			},
		);

		it.skipIf(skipIfNoDb)(
			"lets the first user bootstrap the first organization",
			async () => {
				const first = await signUp("first");
				const org = await testAuth.api.createOrganization({
					body: { name: "First", slug: "first" },
					headers: first.headers,
				});
				expect(org?.slug).toBe("first");

				// ...and the door closes behind them.
				const second = await signUp("second");
				await expect(
					testAuth.api.createOrganization({
						body: { name: "Second", slug: "second" },
						headers: second.headers,
					}),
				).rejects.toMatchObject({ status: "FORBIDDEN" });
			},
		);
	});
});
