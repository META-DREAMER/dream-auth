import { test as base, type Page } from "@playwright/test";
import type { Pool } from "pg";
import {
	cleanupTestUsers,
	createTestUserViaAPI,
	type TestUser,
} from "../helpers/test-user-factory";

/**
 * Authentication fixtures for E2E tests
 *
 * Provides utilities for creating test users and authenticated sessions.
 * Uses API-based user creation to properly hash passwords via BetterAuth.
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
	 * Helper to register via UI
	 */
	registerViaUI: (
		name: string,
		email: string,
		password: string,
	) => Promise<void>;

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
		const result = await createTestUserViaAPI(baseURL, userData);
		if (!result.success) {
			throw new Error(`Failed to create test user: ${result.error}`);
		}

		// Login via UI
		await page.goto("/login");
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
		const result = await createTestUserViaAPI(baseURL, userData);
		if (!result.success) {
			throw new Error(`Failed to create test user: ${result.error}`);
		}

		await use(userData);

		// Cleanup: delete this specific test user
		await cleanupTestUsers(pool, userData.email);
	},

	// Helper to login via UI
	loginViaUI: async ({ page }, use) => {
		const login = async (email: string, password: string) => {
			await page.goto("/login");
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

	// Helper to register via UI
	registerViaUI: async ({ page }, use) => {
		const register = async (name: string, email: string, password: string) => {
			await page.goto("/register");
			await page.fill('input[id="name"]', name);
			await page.fill('input[type="email"]', email);
			await page.fill('input[id="password"]', password);
			await page.fill('input[id="confirmPassword"]', password);
			await page.click('button[type="submit"]');
			// Wait for redirect after successful registration
			await page.waitForURL("/", { timeout: 10000 });
		};

		await use(register);
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
