import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { expect, test } from "../../fixtures";
import { expectAuthenticated } from "../../helpers/assertions";
import { signInWithEmailCode } from "../../helpers/email-code";
import { addVirtualAuthenticator } from "../../helpers/webauthn";

/**
 * Passwordless sign-up: name and email, then an emailed code. No password is
 * ever asked for; a passkey is offered right after.
 */

/** An organization with a pending email invitation for `email`. */
async function seedInvitation(pool: Pool, email: string) {
	const suffix = randomUUID().slice(0, 8);
	const inviterId = randomUUID();
	await pool.query(
		`INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
		 VALUES ($1, $2, 'E2E Inviter', true, NOW(), NOW())`,
		[inviterId, `e2e-inviter-${suffix}@example.com`],
	);
	const org = await pool.query<{ id: string }>(
		`INSERT INTO organization (id, name, slug, "createdAt")
		 VALUES (gen_random_uuid(), $1, $2, NOW()) RETURNING id`,
		[`E2E Org ${suffix}`, `e2e-org-${suffix}`],
	);
	await pool.query(
		`INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
		 VALUES (gen_random_uuid(), $1, $2, 'owner', NOW())`,
		[org.rows[0].id, inviterId],
	);
	const invitation = await pool.query<{ id: string }>(
		`INSERT INTO invitation
		 (id, email, "organizationId", role, status, "inviterId", "expiresAt")
		 VALUES (gen_random_uuid(), $1, $2, 'member', 'pending', $3, NOW() + interval '1 day')
		 RETURNING id`,
		[email, org.rows[0].id, inviterId],
	);
	return {
		invitationId: invitation.rows[0].id,
		orgName: `E2E Org ${suffix}`,
	};
}

test.describe("Passwordless registration", () => {
	test("invite → email code → passkey → accept → sign out → passkey sign-in", async ({
		page,
		pool,
	}) => {
		const email = `e2e-invitee-${Date.now()}@example.com`;
		const { invitationId, orgName } = await seedInvitation(pool, email);
		const authenticator = await addVirtualAuthenticator(page);

		// The invite link, then "Create one".
		await page.goto(`/invite/${invitationId}`);
		await expect(page.getByText(`Join ${orgName}`)).toBeVisible();
		await page.getByRole("link", { name: "Create one" }).click();
		await page.waitForURL(/\/register\?redirect=/);
		await expect(page.locator('input[type="password"]')).toHaveCount(0);

		await page.getByLabel("Name").fill("E2E Invitee");
		await signInWithEmailCode(page, pool, email);

		// Offered a passkey right after the code; add it.
		await expect(page.getByText("Skip the code next time")).toBeVisible();
		const registered = page.waitForResponse((r) =>
			r.url().endsWith("/api/auth/passkey/verify-registration"),
		);
		await page.getByRole("button", { name: "Add a passkey" }).click();
		expect((await registered).status()).toBe(200);

		// Back on the invite, signed in, and it can be accepted.
		await page.waitForURL(`/invite/${invitationId}`);
		await page.getByRole("button", { name: "Accept" }).click();
		await page.waitForURL("/settings", { timeout: 10000 });

		const { rows } = await pool.query(
			`SELECT u.name, u."emailVerified",
			        (SELECT count(*) FROM account a WHERE a."userId" = u.id AND a."providerId" = 'credential')::int AS passwords,
			        (SELECT count(*) FROM passkey p WHERE p."userId" = u.id)::int AS passkeys,
			        (SELECT count(*) FROM member m WHERE m."userId" = u.id)::int AS memberships
			   FROM "user" u WHERE u.email = $1`,
			[email],
		);
		expect(rows[0]).toEqual({
			name: "E2E Invitee",
			emailVerified: true,
			passwords: 0,
			passkeys: 1,
			memberships: 1,
		});

		// Sign out, then back in with the passkey alone.
		const signedOut = await page.request.post("/api/auth/sign-out", {
			data: {},
			headers: { origin: new URL(page.url()).origin },
		});
		expect(signedOut.status(), await signedOut.text()).toBe(200);
		await page.goto("/settings");
		await page.waitForURL(/\/login/);

		// Keep the autofill ceremony /login starts on mount from signing in on
		// its own; the button is what is under test.
		await authenticator.setPresence(false);
		await page.goto("/login");
		const button = page.getByRole("button", { name: "Sign in with Passkey" });
		await button.waitFor();
		await authenticator.setPresence(true);
		await button.click();
		await page.waitForURL("/", { timeout: 10000 });
		await expectAuthenticated(page);
	});

	test("asks for a name and an email, never a password", async ({ page }) => {
		await page.goto("/register");

		await page.getByRole("button", { name: "Email me a code" }).click();

		const isNameValid = await page
			.locator('input[id="name"]')
			.evaluate((el: HTMLInputElement) => el.validity.valid);
		const isEmailValid = await page
			.locator('input[type="email"]')
			.evaluate((el: HTMLInputElement) => el.validity.valid);
		expect(isNameValid).toBe(false);
		expect(isEmailValid).toBe(false);
		await expect(page.locator('input[type="password"]')).toHaveCount(0);
	});

	test("password sign-up is off", async ({ page, baseURL }) => {
		const response = await page.request.post("/api/auth/sign-up/email", {
			data: {
				name: "No Password",
				email: `e2e-nopassword-${Date.now()}@example.com`,
				password: "TestPassword123!",
			},
			headers: { origin: baseURL as string },
		});
		expect(response.status()).toBe(400);
	});

	test("can navigate to login page", async ({ page }) => {
		await page.goto("/register");

		await page.click('text="Sign in"');

		await page.waitForURL(/\/login/);
		await expect(page.locator('input[type="email"]')).toBeVisible();
	});
});
