import { expect, test } from "../../fixtures";
import { signInWithEmailCode } from "../../helpers/email-code";

/**
 * Passwordless sign-up on `/register` (open registration): name and email,
 * then an emailed code. No password is ever asked for. An invitee signs up
 * from the invite link instead: see invite.spec.ts.
 */

test.describe("Passwordless registration", () => {
	test("name, email, code: the account exists, named and verified", async ({
		page,
		pool,
	}) => {
		const email = `e2e-register-${Date.now()}@example.com`;
		await page.goto("/register");
		await page.getByLabel("Name").fill("E2E Registrant");
		await signInWithEmailCode(page, pool, email);
		await page.getByRole("button", { name: "Not now" }).click();
		await page.waitForURL("/", { timeout: 10000 });

		const { rows } = await pool.query(
			`SELECT name, "emailVerified" FROM "user" WHERE email = $1`,
			[email],
		);
		expect(rows[0]).toEqual({ name: "E2E Registrant", emailVerified: true });
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
