import { expect, test } from "../../fixtures";
import {
	expectAuthenticated,
	expectOnLoginPage,
} from "../../helpers/assertions";
import {
	choosePasswordSignIn,
	readSignInCode,
	signInWithEmailCode,
} from "../../helpers/email-code";
import { registerUser } from "../../helpers/navigation";

/**
 * Login E2E Tests
 *
 * An email code is the default on /login; a password stays available for
 * accounts that have one.
 */
test.describe("Email code login", () => {
	test("the email code form is the default", async ({ page }) => {
		await page.goto("/login");

		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Email me a code" }),
		).toBeVisible();
		await expect(page.locator('input[type="password"]')).toHaveCount(0);
	});

	test("a code sign-in offers a passkey once, then remembers 'Not now'", async ({
		page,
		pool,
	}) => {
		const testEmail = `e2e-code-${Date.now()}@example.com`;
		await registerUser(page, "Code User", testEmail, "TestPassword123!");
		await page.context().clearCookies();

		await page.goto("/login");
		await signInWithEmailCode(page, pool, testEmail);
		await expect(page.getByText("Skip the code next time")).toBeVisible();
		await page.getByRole("button", { name: "Not now" }).click();
		await page.waitForURL("/", { timeout: 10000 });
		await expectAuthenticated(page);

		// Same browser, signed out: no second offer.
		await page.context().clearCookies();
		await page.goto("/login");
		await signInWithEmailCode(page, pool, testEmail);
		await page.waitForURL("/", { timeout: 10000 });
		await expectAuthenticated(page);
	});

	test("a wrong code shows an error", async ({ page, pool }) => {
		const testEmail = `e2e-code-wrong-${Date.now()}@example.com`;
		await registerUser(page, "Wrong Code", testEmail, "TestPassword123!");
		await page.context().clearCookies();

		await page.goto("/login");
		await page.getByLabel("Email").fill(testEmail);
		await page.getByRole("button", { name: "Email me a code" }).click();
		const code = await readSignInCode(pool, testEmail);
		const wrong = code === "000000" ? "111111" : "000000";
		await page.locator("input[data-input-otp]").fill(wrong);
		await page.getByRole("button", { name: "Continue" }).click();

		await expect(page.locator("text=/invalid|code/i").first()).toBeVisible({
			timeout: 5000,
		});
		await expect(page).toHaveURL(/\/login/);
	});
});

test.describe("Email/Password Login", () => {
	test("successful login redirects to home page", async ({ page }) => {
		const testEmail = `e2e-login-${Date.now()}@example.com`;
		const testPassword = "TestPassword123!";
		const testName = "E2E Login Test User";

		// First register a user
		await registerUser(page, testName, testEmail, testPassword);

		// Wait for auto-redirect after registration
		await page.waitForURL("/", { timeout: 10000 });

		// Sign out (clear cookies)
		await page.context().clearCookies();

		// Now login
		await page.goto("/login");
		await choosePasswordSignIn(page);
		await page.fill('input[type="email"]', testEmail);
		await page.fill('input[type="password"]', testPassword);
		await page.click('button[type="submit"]');

		// Should redirect to home
		await page.waitForURL("/", { timeout: 10000 });
		await expectAuthenticated(page);
	});

	test("shows error with invalid credentials", async ({ page }) => {
		await page.goto("/login");
		await choosePasswordSignIn(page);

		await page.fill('input[type="email"]', "nonexistent@example.com");
		await page.fill('input[type="password"]', "WrongPassword123!");
		await page.click('button[type="submit"]');

		// Should stay on login page
		await expectOnLoginPage(page);

		// Should show error message
		await expect(
			page.locator("text=/invalid|incorrect|wrong/i").first(),
		).toBeVisible({ timeout: 5000 });
	});

	test("preserves redirect URL after login", async ({ page }) => {
		const testEmail = `e2e-redirect-${Date.now()}@example.com`;
		const testPassword = "TestPassword123!";

		// Register user
		await registerUser(page, "Redirect Test", testEmail, testPassword);
		await page.waitForURL("/", { timeout: 10000 });
		await page.context().clearCookies();

		// Try to access protected route
		await page.goto("/settings");

		// Should redirect to login with redirect param
		await page.waitForURL(/\/login\?redirect/, { timeout: 10000 });

		// Login
		await choosePasswordSignIn(page);
		await page.fill('input[type="email"]', testEmail);
		await page.fill('input[type="password"]', testPassword);
		await page.click('button[type="submit"]');

		// Should redirect back to settings
		await page.waitForURL("/settings", { timeout: 10000 });
	});

	test("shows loading state during submission", async ({ page }) => {
		await page.goto("/login");
		await choosePasswordSignIn(page);

		await page.fill('input[type="email"]', "test@example.com");
		await page.fill('input[type="password"]', "password123");

		// Click submit and check for loading state
		const submitButton = page.locator('button[type="submit"]');
		await submitButton.click();

		// Button should be disabled during submission
		await expect(submitButton).toBeDisabled();
	});

	test("can navigate to registration page", async ({ page }) => {
		await page.goto("/login");

		// Click the registration link
		await page.click('text="Create one"');

		// Should navigate to register page
		await page.waitForURL(/\/register/);
		await expect(page.locator('input[id="name"]')).toBeVisible();
	});
});
