import { expect, test } from "../../fixtures";
import { expectAuthenticated } from "../../helpers/assertions";

/**
 * Email/Password Registration E2E Tests
 *
 * Tests the registration functionality including:
 * - Successful registration with valid data
 * - Validation errors (password mismatch, weak password)
 * - Duplicate email handling
 * - Auto-login after registration
 */
test.describe("Email/Password Registration", () => {
	test("successful registration shows success message and redirects", async ({
		page,
	}) => {
		const testEmail = `e2e-register-${Date.now()}@example.com`;
		const testPassword = "TestPassword123!";
		const testName = "E2E Register Test";

		await page.goto("/register");

		await page.fill('input[id="name"]', testName);
		await page.fill('input[type="email"]', testEmail);
		await page.fill('input[id="password"]', testPassword);
		await page.fill('input[id="confirmPassword"]', testPassword);
		await page.click('button[type="submit"]');

		// Should show success message
		await expect(page.locator('text="Account created"')).toBeVisible({
			timeout: 10000,
		});

		// Should auto-redirect to home
		await page.waitForURL("/", { timeout: 5000 });
		await expectAuthenticated(page);
	});

	test("shows error when passwords do not match", async ({ page }) => {
		await page.goto("/register");

		await page.fill('input[id="name"]', "Test User");
		await page.fill('input[type="email"]', "test@example.com");
		await page.fill('input[id="password"]', "Password123!");
		await page.fill('input[id="confirmPassword"]', "DifferentPassword123!");
		await page.click('button[type="submit"]');

		// Should show password mismatch error
		await expect(
			page.locator("text=/passwords? (do not|don't) match/i").first(),
		).toBeVisible({ timeout: 5000 });

		// Should stay on register page
		await expect(page).toHaveURL(/\/register/);
	});

	test("shows error for duplicate email", async ({ page }) => {
		const testEmail = `e2e-duplicate-${Date.now()}@example.com`;
		const testPassword = "TestPassword123!";

		// Register first user
		await page.goto("/register");
		await page.fill('input[id="name"]', "First User");
		await page.fill('input[type="email"]', testEmail);
		await page.fill('input[id="password"]', testPassword);
		await page.fill('input[id="confirmPassword"]', testPassword);
		await page.click('button[type="submit"]');

		// Wait for success and redirect
		await page.waitForURL("/", { timeout: 10000 });

		// Clear session and try to register with same email
		await page.context().clearCookies();
		await page.goto("/register");

		await page.fill('input[id="name"]', "Second User");
		await page.fill('input[type="email"]', testEmail);
		await page.fill('input[id="password"]', testPassword);
		await page.fill('input[id="confirmPassword"]', testPassword);
		await page.click('button[type="submit"]');

		// Should show error about existing user
		await expect(
			page.locator("text=/already exists|already registered|in use/i").first(),
		).toBeVisible({ timeout: 5000 });
	});

	test("requires all fields to be filled", async ({ page }) => {
		await page.goto("/register");

		// Try to submit without filling anything
		await page.click('button[type="submit"]');

		// Form should have validation (HTML5 required attributes)
		const nameInput = page.locator('input[id="name"]');
		const emailInput = page.locator('input[type="email"]');

		// Check HTML5 validation state
		const isNameValid = await nameInput.evaluate(
			(el: HTMLInputElement) => el.validity.valid,
		);
		const isEmailValid = await emailInput.evaluate(
			(el: HTMLInputElement) => el.validity.valid,
		);

		expect(isNameValid).toBe(false);
		expect(isEmailValid).toBe(false);
	});

	test("shows loading state during submission", async ({ page }) => {
		await page.goto("/register");

		await page.fill('input[id="name"]', "Test User");
		await page.fill('input[type="email"]', "test@example.com");
		await page.fill('input[id="password"]', "TestPassword123!");
		await page.fill('input[id="confirmPassword"]', "TestPassword123!");

		const submitButton = page.locator('button[type="submit"]');
		await submitButton.click();

		// Button should be disabled during submission
		await expect(submitButton).toBeDisabled();
	});

	test("can navigate to login page", async ({ page }) => {
		await page.goto("/register");

		// Click the login link
		await page.click('text="Sign in"');

		// Should navigate to login page
		await page.waitForURL(/\/login/);
		await expect(page.locator('input[type="email"]')).toBeVisible();
	});
});
