import { expect, test } from "@playwright/test";

/**
 * Health check tests
 *
 * Verifies that the application is running and responding correctly.
 * These tests should always pass if the E2E infrastructure is working.
 */
test.describe("Health Check", () => {
	test("GET /api/health returns 200 OK", async ({ request }) => {
		const response = await request.get("/api/health");

		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body).toHaveProperty("status", "ok");
		expect(body).toHaveProperty("timestamp");
	});

	test("application renders home page", async ({ page }) => {
		await page.goto("/");

		// Should not error
		expect(page.url()).toContain("localhost");
	});

	test("login page is accessible", async ({ page }) => {
		await page.goto("/login");

		// Should have login form elements
		await expect(page.locator('input[type="email"]')).toBeVisible();
		await expect(page.locator('input[type="password"]')).toBeVisible();
		await expect(page.locator('button[type="submit"]')).toBeVisible();
	});

	test("register page is accessible", async ({ page }) => {
		await page.goto("/register");

		// Should have registration form elements
		await expect(page.locator('input[type="email"]')).toBeVisible();
		await expect(page.locator('input[id="password"]')).toBeVisible();
	});
});
