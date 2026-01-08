import { expect, test } from "../../fixtures";
import { registerUser } from "../../helpers/navigation";

/**
 * Forward Auth Endpoint E2E Tests
 *
 * Tests the /api/verify endpoint used for Kubernetes forward auth:
 * - Returns 401 for unauthenticated requests
 * - Returns 200 with headers for authenticated requests
 * - Headers contain correct user information
 */
test.describe("Forward Auth - /api/verify", () => {
	test("returns 401 for unauthenticated requests", async ({ request }) => {
		const response = await request.get("/api/verify");

		expect(response.status()).toBe(401);
	});

	test("returns 200 with session headers for authenticated requests", async ({
		page,
		context,
	}) => {
		const testEmail = `e2e-forward-${Date.now()}@example.com`;
		const testPassword = "TestPassword123!";
		const testName = "Forward Auth Test";

		// Register and login (to get session cookie)
		await registerUser(page, testName, testEmail, testPassword);
		await page.waitForURL("/", { timeout: 10000 });

		// Make API request with cookies from the authenticated page
		const request = context.request;
		const response = await request.get("/api/verify");

		expect(response.status()).toBe(200);

		// Check headers
		const headers = response.headers();

		// X-Auth-User should contain the user's name
		expect(headers["x-auth-user"]).toBe(testName);

		// X-Auth-Email should contain the user's email
		expect(headers["x-auth-email"]).toBe(testEmail);

		// X-Auth-Id should be present
		expect(headers["x-auth-id"]).toBeTruthy();
	});

	test("returns correct headers with user information", async ({
		page,
		context,
	}) => {
		const testEmail = `e2e-headers-${Date.now()}@example.com`;
		const testPassword = "TestPassword123!";
		const testName = "Header Test User";

		// Register with specific name
		await registerUser(page, testName, testEmail, testPassword);
		await page.waitForURL("/", { timeout: 10000 });

		// Verify headers
		const response = await context.request.get("/api/verify");

		expect(response.status()).toBe(200);

		const headers = response.headers();
		expect(headers["x-auth-user"]).toBe(testName);
		expect(headers["x-auth-email"]).toBe(testEmail);
	});

	test("returns 401 after session is cleared", async ({ page, context }) => {
		const testEmail = `e2e-clear-${Date.now()}@example.com`;
		const testPassword = "TestPassword123!";

		// Register and login
		await registerUser(page, "Clear Test", testEmail, testPassword);
		await page.waitForURL("/", { timeout: 10000 });

		// Verify authenticated
		let response = await context.request.get("/api/verify");
		expect(response.status()).toBe(200);

		// Clear cookies
		await context.clearCookies();

		// Should now return 401
		response = await context.request.get("/api/verify");
		expect(response.status()).toBe(401);
	});
});
