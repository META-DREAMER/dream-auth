import type { Page } from "@playwright/test";
import { choosePasswordSignIn } from "./email-code";

/**
 * Navigation helpers for E2E tests
 */

/** Same origin as `baseURL` in playwright.config.ts. */
const ORIGIN = `http://localhost:${process.env.E2E_PORT || "3000"}`;

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
	await choosePasswordSignIn(page);
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
 * Create a password user, sign this page's browser context in as them, and
 * open `/`.
 *
 * `/register` no longer offers a password, so this goes through the API.
 * Password accounts still exist (created before email codes became the
 * default) and must keep signing in with their password.
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
	const response = await page.request.post("/api/auth/sign-up/email", {
		data: { name, email, password },
		headers: { origin: ORIGIN },
	});
	if (!response.ok()) {
		throw new Error(`Sign-up failed: HTTP ${response.status()}`);
	}
	await page.goto("/");
}

/**
 * Wait for page to be fully loaded (network idle)
 *
 * @param page - Playwright page
 */
export async function waitForPageLoad(page: Page): Promise<void> {
	await page.waitForLoadState("networkidle", { timeout: 30000 });
}
