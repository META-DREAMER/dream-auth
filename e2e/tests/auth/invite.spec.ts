import type { Page } from "@playwright/test";
import type { Pool } from "pg";
import { expect, test } from "../../fixtures";
import { expectAuthenticated } from "../../helpers/assertions";
import { requestAndEnterCode } from "../../helpers/email-code";
import { seedInvitation } from "../../helpers/invitations";
import {
	cleanupTestUsers,
	createTestUser,
} from "../../helpers/test-user-factory";
import { addVirtualAuthenticator } from "../../helpers/webauthn";

/**
 * The invite link is the whole journey: name, the invited email (prefilled,
 * read-only), "Continue" emails a code, the code signs in and joins, then a
 * passkey is offered and a done screen follows.
 */

async function membership(pool: Pool, email: string) {
	const { rows } = await pool.query(
		`SELECT u.name, u."emailVerified",
		        (SELECT count(*) FROM passkey p WHERE p."userId" = u.id)::int AS passkeys,
		        (SELECT count(*) FROM member m WHERE m."userId" = u.id)::int AS memberships
		   FROM "user" u WHERE u.email = $1`,
		[email],
	);
	return rows[0];
}

async function signInWithPassword(page: Page, email: string, password: string) {
	const response = await page.request.post("/api/auth/sign-in/email", {
		data: { email, password },
		headers: { origin: new URL(page.url() || "http://localhost").origin },
	});
	expect(response.status(), await response.text()).toBe(200);
}

test.describe("Invite link", () => {
	test("name → code → joined automatically → passkey → done, then passkey sign-in", async ({
		page,
		pool,
	}) => {
		const email = `e2e-invitee-${Date.now()}@example.com`;
		const { invitationId, orgName, inviterName } = await seedInvitation(
			pool,
			email,
		);
		const authenticator = await addVirtualAuthenticator(page);

		await page.goto(`/invite/${invitationId}`);
		await expect(page.getByText(`Join ${orgName}`)).toBeVisible();
		await expect(page.getByText(`${inviterName} invited you`)).toBeVisible();

		// One form: no generic sign-in options, the email fixed.
		const emailField = page.getByLabel("Email");
		await expect(emailField).toHaveValue(email);
		await expect(emailField).toHaveAttribute("readonly", "");
		for (const other of [
			"Sign in with Passkey",
			"Sign in with a password instead",
			"Connect Wallet",
		]) {
			await expect(page.getByRole("button", { name: other })).toHaveCount(0);
		}
		await expect(page.getByRole("link", { name: "Create one" })).toHaveCount(0);
		await expect(page.locator('input[type="password"]')).toHaveCount(0);

		// Opening the page sent nothing.
		const before = await pool.query(
			"SELECT 1 FROM verification WHERE identifier = $1",
			[`sign-in-otp-${email}`],
		);
		expect(before.rowCount).toBe(0);

		await page.getByLabel("Name").fill("E2E Invitee");
		await requestAndEnterCode(page, pool, email, "Continue");

		// Joined before the passkey offer shows.
		await expect(page.getByText("Skip the code next time")).toBeVisible();
		expect(await membership(pool, email)).toMatchObject({ memberships: 1 });

		const registered = page.waitForResponse((r) =>
			r.url().endsWith("/api/auth/passkey/verify-registration"),
		);
		await page.getByRole("button", { name: "Add a passkey" }).click();
		expect((await registered).status()).toBe(200);

		await expect(page.getByText(`You've joined ${orgName}`)).toBeVisible();
		expect(page.url()).toContain(`/invite/${invitationId}`);
		expect(await membership(pool, email)).toEqual({
			name: "E2E Invitee",
			emailVerified: true,
			passkeys: 1,
			memberships: 1,
		});

		// Sign out, then back in with the passkey alone.
		const signedOut = await page.request.post("/api/auth/sign-out", {
			data: {},
			headers: { origin: new URL(page.url()).origin },
		});
		expect(signedOut.status(), await signedOut.text()).toBe(200);
		await authenticator.setPresence(false);
		await page.goto("/login");
		const button = page.getByRole("button", { name: "Sign in with Passkey" });
		await button.waitFor();
		await authenticator.setPresence(true);
		await button.click();
		await page.waitForURL("/", { timeout: 10000 });
		await expectAuthenticated(page);
	});

	test("an existing account with the invited email signs in with the code and joins", async ({
		page,
		pool,
	}) => {
		const user = await createTestUser(pool, {
			email: `e2e-test-existing-${Date.now()}@example.com`,
			name: "Existing Name",
		});
		const { invitationId, orgName } = await seedInvitation(pool, user.email, {
			inviterName: "",
		});

		await page.goto(`/invite/${invitationId}`);
		// No inviter name: the organization stands in.
		await expect(
			page.getByText(`An admin of ${orgName} invited you`),
		).toBeVisible();
		await page.getByLabel("Name").fill("Ignored");
		await requestAndEnterCode(page, pool, user.email, "Continue");
		await page.getByRole("button", { name: "Not now" }).click();

		await expect(page.getByText(`You've joined ${orgName}`)).toBeVisible();
		expect(await membership(pool, user.email)).toMatchObject({
			name: "Existing Name",
			memberships: 1,
		});
		await cleanupTestUsers(pool, user.email);
	});

	test("signed in as the invitee: one-click Join", async ({ page, pool }) => {
		const user = await createTestUser(pool, {
			email: `e2e-test-joiner-${Date.now()}@example.com`,
		});
		const { invitationId, orgName } = await seedInvitation(pool, user.email);
		await page.goto("/login");
		await signInWithPassword(page, user.email, user.password);

		await page.goto(`/invite/${invitationId}`);
		await expect(page.getByLabel("Email")).toHaveCount(0);
		await page.getByRole("button", { name: `Join ${orgName}` }).click();

		await expect(page.getByText(`You've joined ${orgName}`)).toBeVisible();
		expect(await membership(pool, user.email)).toMatchObject({
			memberships: 1,
		});
		await cleanupTestUsers(pool, user.email);
	});

	test("signed in as someone else: says so and offers to switch", async ({
		authenticatedPage: page,
		pool,
	}) => {
		const email = `e2e-invitee-other-${Date.now()}@example.com`;
		const { invitationId } = await seedInvitation(pool, email);

		await page.goto(`/invite/${invitationId}`);
		await expect(
			page.getByText(`This invitation is for ${email}`),
		).toBeVisible();
		await expect(page.getByRole("button", { name: /^Join / })).toHaveCount(0);

		await page.getByRole("button", { name: "Switch account" }).click();

		// Same invite link, signed out, the form for the invited address.
		await expect(page.getByLabel("Email")).toHaveValue(email);
		expect(page.url()).toContain(`/invite/${invitationId}`);
	});

	test("an expired invitation says so and offers nothing else", async ({
		page,
		pool,
	}) => {
		const email = `e2e-invitee-expired-${Date.now()}@example.com`;
		const { invitationId, orgName } = await seedInvitation(pool, email, {
			expired: true,
		});

		await page.goto(`/invite/${invitationId}`);
		await expect(page.getByText("This invitation has expired")).toBeVisible();
		await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
		await expect(page.locator("input")).toHaveCount(0);
		// The page learns nothing about it beyond its state.
		await expect(page.getByText(orgName)).toHaveCount(0);
		await expect(page.getByText(email)).toHaveCount(0);
	});

	test("an accepted invitation says so", async ({ page, pool }) => {
		const email = `e2e-invitee-used-${Date.now()}@example.com`;
		const { invitationId } = await seedInvitation(pool, email, {
			status: "accepted",
		});

		await page.goto(`/invite/${invitationId}`);
		await expect(page.getByText("This invitation can't be used")).toBeVisible();
		await expect(page.locator("input")).toHaveCount(0);
	});

	test("an unverified account that took the invited email cannot accept", async ({
		page,
		pool,
	}) => {
		// changeEmail lets an unverified account set any address without proof;
		// the invitation must still need a verified one.
		const user = await createTestUser(pool, {
			email: `e2e-test-unverified-${Date.now()}@example.com`,
		});
		await pool.query(
			`UPDATE "user" SET "emailVerified" = false WHERE email = $1`,
			[user.email],
		);
		const { invitationId } = await seedInvitation(pool, user.email);
		await page.goto("/login");
		await signInWithPassword(page, user.email, user.password);

		const response = await page.request.post(
			"/api/auth/organization/accept-invitation",
			{
				data: { invitationId },
				headers: { origin: new URL(page.url()).origin },
			},
		);
		expect(response.status()).toBe(403);
		expect(await membership(pool, user.email)).toMatchObject({
			memberships: 0,
		});
		await cleanupTestUsers(pool, user.email);
	});
});
