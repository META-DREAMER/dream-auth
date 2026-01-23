import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Custom assertions for E2E tests
 */

/**
 * Assert that a session cookie exists
 *
 * @param page - Playwright page
 */
export async function expectSessionCookie(page: Page): Promise<void> {
	const cookies = await page.context().cookies();
	const sessionCookie = cookies.find(
		(c) =>
			c.name.includes("better-auth") ||
			c.name.includes("session") ||
			c.name === "__Secure-better-auth.session_token",
	);
	expect(sessionCookie, "Session cookie should exist").toBeDefined();
}

/**
 * Assert that no session cookie exists
 *
 * @param page - Playwright page
 */
export async function expectNoSessionCookie(page: Page): Promise<void> {
	const cookies = await page.context().cookies();
	const sessionCookie = cookies.find(
		(c) =>
			c.name.includes("better-auth") ||
			c.name.includes("session") ||
			c.name === "__Secure-better-auth.session_token",
	);
	expect(sessionCookie, "Session cookie should not exist").toBeUndefined();
}

/**
 * Assert that the user is on the login page
 *
 * @param page - Playwright page
 */
export async function expectOnLoginPage(page: Page): Promise<void> {
	await expect(page).toHaveURL(/\/login/);
	await expect(page.locator('button[type="submit"]')).toContainText(/sign in/i);
}

/**
 * Assert that the user is authenticated (on home or protected page)
 *
 * @param page - Playwright page
 */
export async function expectAuthenticated(page: Page): Promise<void> {
	// Should not be on login page
	await expect(page).not.toHaveURL(/\/login/);

	// Session cookie should exist
	await expectSessionCookie(page);
}

/**
 * Assert that an error message is displayed
 *
 * @param page - Playwright page
 * @param errorPattern - Regex or string to match
 */
export async function expectErrorMessage(
	page: Page,
	errorPattern: string | RegExp,
): Promise<void> {
	const errorLocator = page.locator('[role="alert"], .error, [data-error]');
	await expect(errorLocator).toBeVisible();

	if (typeof errorPattern === "string") {
		await expect(errorLocator).toContainText(errorPattern);
	} else {
		await expect(errorLocator).toContainText(errorPattern);
	}
}

/**
 * Assert form validation error
 *
 * @param page - Playwright page
 * @param fieldId - The field ID with the error
 * @param errorText - Expected error text
 */
export async function expectFieldError(
	page: Page,
	fieldId: string,
	errorText: string,
): Promise<void> {
	const field = page.locator(`#${fieldId}`);
	const errorMessage = page.locator(
		`[data-field-error="${fieldId}"], #${fieldId}-error, [aria-describedby="${fieldId}"] ~ .error`,
	);

	await expect(field).toHaveAttribute("aria-invalid", "true");
	await expect(errorMessage).toContainText(errorText);
}
