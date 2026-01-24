import { expect, test } from "../../fixtures";
import {
	expectAuthenticated,
	expectOnLoginPage,
} from "../../helpers/assertions";
import { registerUser } from "../../helpers/navigation";

/**
 * Email/Password Login E2E Tests
 *
 * Tests the core login functionality including:
 * - Successful login with valid credentials
 * - Failed login with invalid credentials
 * - Redirect preservation after login
 * - Session persistence
 */
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
		await page.fill('input[type="email"]', testEmail);
		await page.fill('input[type="password"]', testPassword);
		await page.click('button[type="submit"]');

		// Should redirect to home
		await page.waitForURL("/", { timeout: 10000 });
		await expectAuthenticated(page);
	});

	test("shows error with invalid credentials", async ({ page }) => {
		await page.goto("/login");

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
		await page.fill('input[type="email"]', testEmail);
		await page.fill('input[type="password"]', testPassword);
		await page.click('button[type="submit"]');

		// Should redirect back to settings
		await page.waitForURL("/settings", { timeout: 10000 });
	});

	test("shows loading state during submission", async ({ page }) => {
		await page.goto("/login");

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
