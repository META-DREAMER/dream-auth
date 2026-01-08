import { test as base, type Page } from "@playwright/test";
import type { Pool, PoolClient } from "pg";
import { createTestUser, type TestUser } from "../helpers/test-user-factory";

/**
 * Authentication fixtures for E2E tests
 *
 * Provides utilities for creating test users and authenticated sessions.
 */

export type AuthFixtures = {
	/**
	 * Create a test user and sign them in via the UI
	 * Returns the page with an authenticated session
	 */
	authenticatedPage: Page;

	/**
	 * The test user created by authenticatedPage fixture
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

export const authFixtures = base.extend<
	AuthFixtures & { pool: Pool; dbClient: PoolClient }
>({
	// Create an authenticated page with a test user
	authenticatedPage: async ({ page, dbClient }, use) => {
		// Create a test user in the database
		const user = await createTestUser(dbClient);

		// Login via UI
		await page.goto("/login");
		await page.fill('input[type="email"]', user.email);
		await page.fill('input[type="password"]', user.password);
		await page.click('button[type="submit"]');

		// Wait for successful redirect
		await page.waitForURL("/", { timeout: 10000 });

		await use(page);
	},

	// Expose the test user created by authenticatedPage
	testUser: async ({ dbClient }, use) => {
		const user = await createTestUser(dbClient);
		await use(user);
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
			// Wait for success message or redirect
			await page.waitForSelector('text="Account created"', { timeout: 10000 });
		};

		await use(register);
	},

	// Helper to logout
	logout: async ({ page }, use) => {
		const logout = async () => {
			// Navigate to settings to find logout button
			// Or clear cookies directly
			await page.context().clearCookies();
			await page.goto("/login");
		};

		await use(logout);
	},
});
