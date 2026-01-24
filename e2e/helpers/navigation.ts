import type { Page } from "@playwright/test";

/**
 * Navigation helpers for E2E tests
 */

/**
 * Login and navigate to a target URL
 *
 * @param page - Playwright page
 * @param email - User email
 * @param password - User password
 * @param targetUrl - URL to navigate to after login (default: /)
 */
export async function loginAndNavigate(
	page: Page,
	email: string,
	password: string,
	targetUrl = "/",
): Promise<void> {
	await page.goto("/login");
	await page.waitForLoadState("networkidle");

	// Use label-based selectors for more robust targeting
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill(password);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(targetUrl, { timeout: 10000 });
}

/**
 * Expect a redirect to the login page when accessing a protected route
 *
 * @param page - Playwright page
 * @param protectedPath - The protected path to access
 */
export async function expectAuthRedirect(
	page: Page,
	protectedPath: string,
): Promise<void> {
	await page.goto(protectedPath);
	// Should redirect to login with redirect query param
	await page.waitForURL(
		(url) =>
			url.pathname === "/login" &&
			url.searchParams.get("redirect") === protectedPath,
		{ timeout: 10000 },
	);
}

/**
 * Sign out and navigate to login page
 *
 * @param page - Playwright page
 */
export async function signOutAndNavigate(page: Page): Promise<void> {
	// Clear cookies to sign out
	await page.context().clearCookies();
	await page.goto("/login");
}

/**
 * Register a new user via the UI
 *
 * @param page - Playwright page
 * @param name - User's name
 * @param email - User's email
 * @param password - User's password
 */
export async function registerUser(
	page: Page,
	name: string,
	email: string,
	password: string,
): Promise<void> {
	await page.goto("/register");
	await page.waitForLoadState("networkidle");

	// Use label-based selectors for more robust targeting
	await page.getByLabel("Name").fill(name);
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(password);
	await page.getByLabel("Confirm Password").fill(password);
	await page.getByRole("button", { name: "Create account" }).click();

	// Wait for success message or redirect to home
	await Promise.race([
		page.waitForSelector('text="Account created!"', { timeout: 15000 }),
		page.waitForURL("/", { timeout: 15000 }),
	]);
}

/**
 * Wait for page to be fully loaded (network idle)
 *
 * @param page - Playwright page
 */
export async function waitForPageLoad(page: Page): Promise<void> {
	await page.waitForLoadState("networkidle", { timeout: 30000 });
}
