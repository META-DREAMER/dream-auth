import { expect, test } from "../../fixtures";
import { expectAuthenticated } from "../../helpers/assertions";
import { registerUser } from "../../helpers/navigation";

/**
 * Protected Routes E2E Tests
 *
 * Tests that protected routes correctly:
 * - Redirect unauthenticated users to login
 * - Allow authenticated users access
 * - Preserve redirect URLs
 */
test.describe("Protected Routes - Auth Required", () => {
	test("unauthenticated user is redirected from /settings to /login", async ({
		page,
	}) => {
		await page.goto("/settings");

		// Should redirect to login with redirect param
		await page.waitForURL(/\/login\?redirect=/, { timeout: 10000 });

		// Verify the redirect param is preserved
		const url = new URL(page.url());
		expect(url.searchParams.get("redirect")).toBe("/settings");
	});

	test("authenticated user can access /settings", async ({ page }) => {
		const testEmail = `e2e-settings-${Date.now()}@example.com`;
		const testPassword = "TestPassword123!";

		// Register and wait for redirect
		await registerUser(page, "Settings Test", testEmail, testPassword);
		await page.waitForURL("/", { timeout: 10000 });

		// Navigate to settings
		await page.goto("/settings");

		// Should stay on settings (not redirect)
		await expect(page).toHaveURL(/\/settings/);
		await expectAuthenticated(page);
	});

	test("multiple protected routes redirect correctly", async ({ page }) => {
		// Test various protected routes
		const protectedRoutes = ["/settings", "/org", "/org/settings"];

		for (const route of protectedRoutes) {
			await page.goto(route);

			// Should redirect to login
			await page.waitForURL(/\/login/, { timeout: 10000 });

			// Clear any partial state
			await page.context().clearCookies();
		}
	});

	test("redirect param is preserved through login flow", async ({ page }) => {
		const testEmail = `e2e-preserve-${Date.now()}@example.com`;
		const testPassword = "TestPassword123!";

		// Register user first
		await registerUser(page, "Preserve Test", testEmail, testPassword);
		await page.waitForURL("/", { timeout: 10000 });
		await page.context().clearCookies();

		// Try to access protected route
		await page.goto("/settings");
		await page.waitForURL(/\/login\?redirect=/, { timeout: 10000 });

		// Login
		await page.fill('input[type="email"]', testEmail);
		await page.fill('input[type="password"]', testPassword);
		await page.click('button[type="submit"]');

		// Should redirect back to settings
		await page.waitForURL("/settings", { timeout: 10000 });
	});

	test("public routes are accessible without authentication", async ({
		page,
	}) => {
		// Login page
		await page.goto("/login");
		await expect(page).toHaveURL("/login");

		// Register page
		await page.goto("/register");
		await expect(page).toHaveURL("/register");

		// Home page
		await page.goto("/");
		// Home might redirect based on auth state, but should be accessible
		expect(page.url()).toContain("localhost");
	});
});
