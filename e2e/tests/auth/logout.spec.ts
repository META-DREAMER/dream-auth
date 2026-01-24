import { test } from "../../fixtures";
import {
	expectAuthenticated,
	expectNoSessionCookie,
} from "../../helpers/assertions";
import { registerUser } from "../../helpers/navigation";

/**
 * Logout E2E Tests
 *
 * Tests the logout/sign-out functionality including:
 * - Session cookie clearing
 * - Redirect to login after accessing protected routes
 * - Session not persisted after logout
 */
test.describe("Logout", () => {
	test("clearing cookies removes authentication", async ({ page }) => {
		const testEmail = `e2e-logout-${Date.now()}@example.com`;
		const testPassword = "TestPassword123!";

		// Register and login
		await registerUser(page, "Logout Test", testEmail, testPassword);
		await page.waitForURL("/", { timeout: 10000 });

		// Verify authenticated
		await expectAuthenticated(page);

		// Clear cookies (simulates logout)
		await page.context().clearCookies();

		// Should no longer have session cookie
		await expectNoSessionCookie(page);

		// Trying to access protected route should redirect to login
		await page.goto("/settings");
		await page.waitForURL(/\/login/, { timeout: 10000 });
	});

	test("after logout, protected routes redirect to login", async ({ page }) => {
		const testEmail = `e2e-logout-redirect-${Date.now()}@example.com`;
		const testPassword = "TestPassword123!";

		// Register and login
		await registerUser(page, "Logout Redirect Test", testEmail, testPassword);
		await page.waitForURL("/", { timeout: 10000 });

		// Clear cookies
		await page.context().clearCookies();

		// Access settings (protected)
		await page.goto("/settings");

		// Should redirect to login
		await page.waitForURL(/\/login\?redirect/, { timeout: 10000 });
	});

	test("session does not persist after browser context is cleared", async ({
		browser,
	}) => {
		const context = await browser.newContext();
		const page = await context.newPage();

		const testEmail = `e2e-session-${Date.now()}@example.com`;
		const testPassword = "TestPassword123!";

		// Register
		await registerUser(page, "Session Test", testEmail, testPassword);
		await page.waitForURL("/", { timeout: 10000 });

		// Verify authenticated
		await expectAuthenticated(page);

		// Close context
		await context.close();

		// Create new context (simulates new browser session)
		const newContext = await browser.newContext();
		const newPage = await newContext.newPage();

		// Access protected route
		await newPage.goto("/settings");

		// Should redirect to login (no session)
		await newPage.waitForURL(/\/login/, { timeout: 10000 });

		await newContext.close();
	});
});
