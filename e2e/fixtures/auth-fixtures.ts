import { test as base, type Page } from "@playwright/test";
import type { Pool } from "pg";
import { choosePasswordSignIn } from "../helpers/email-code";
import {
	cleanupTestUsers,
	createTestUser,
	type TestUser,
} from "../helpers/test-user-factory";

/**
 * Authentication fixtures for E2E tests
 *
 * Provides utilities for creating test users and authenticated sessions.
 * Inserts password users with a better-auth password hash (sign-up is off).
 */

export type AuthFixtures = {
	/**
	 * Create a test user and sign them in via the UI
	 * Returns the page with an authenticated session
	 */
	authenticatedPage: Page;

	/**
	 * The test user created for this test
	 */
	testUser: TestUser;

	/**
	 * Helper to login via UI (for testing login flow itself)
	 */
	loginViaUI: (email: string, password: string) => Promise<void>;

	/**
	 * Helper to logout
	 */
	logout: () => Promise<void>;
};

/**
 * Generate unique test user data for each test
 */
function generateTestUserData(): TestUser {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	return {
		id: "", // Will be assigned by BetterAuth
		email: `e2e-test-${timestamp}-${random}@example.com`,
		password: "TestPassword123!",
		name: "E2E Test User",
	};
}

export const authFixtures = base.extend<AuthFixtures & { pool: Pool }>({
	// Create a test user via API and sign them in via UI
	authenticatedPage: async ({ page, pool, baseURL }, use) => {
		if (!baseURL) {
			throw new Error("baseURL is required - ensure webServer is configured");
		}
		const userData = generateTestUserData();

		// Create user via API (properly hashes password)
		await createTestUser(pool, userData);

		// Login via UI
		await page.goto("/login");
		await choosePasswordSignIn(page);
		await page.fill('input[type="email"]', userData.email);
		await page.fill('input[type="password"]', userData.password);
		await page.click('button[type="submit"]');

		// Wait for successful redirect
		await page.waitForURL("/", { timeout: 10000 });

		await use(page);

		// Cleanup: delete this specific test user
		await cleanupTestUsers(pool, userData.email);
	},

	// Create a test user via API and expose it
	testUser: async ({ pool, baseURL }, use) => {
		if (!baseURL) {
			throw new Error("baseURL is required - ensure webServer is configured");
		}
		const userData = generateTestUserData();

		// Create user via API (properly hashes password)
		await createTestUser(pool, userData);

		await use(userData);

		// Cleanup: delete this specific test user
		await cleanupTestUsers(pool, userData.email);
	},

	// Helper to login via UI
	loginViaUI: async ({ page }, use) => {
		const login = async (email: string, password: string) => {
			await page.goto("/login");
			await choosePasswordSignIn(page);
			await page.fill('input[type="email"]', email);
			await page.fill('input[type="password"]', password);
			await page.click('button[type="submit"]');
			// Wait for navigation to complete
			await page.waitForURL((url) => !url.pathname.includes("/login"), {
				timeout: 10000,
			});
		};

		await use(login);
	},

	// Helper to logout
	logout: async ({ page }, use) => {
		const logout = async () => {
			// Clear cookies directly
			await page.context().clearCookies();
			await page.goto("/login");
		};

		await use(logout);
	},
});
