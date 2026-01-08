import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

/**
 * Test user type
 */
export type TestUser = {
	id: string;
	email: string;
	password: string;
	name: string;
};

/**
 * Create a test user in the database
 *
 * This directly inserts into BetterAuth's tables to create a user
 * that can be used for E2E testing.
 *
 * @param client - Database client (within transaction)
 * @param overrides - Optional overrides for user properties
 * @returns Created test user with credentials
 */
export async function createTestUser(
	client: PoolClient | Pool,
	overrides: Partial<TestUser> = {},
): Promise<TestUser> {
	const uniqueId = randomUUID();
	const timestamp = Date.now();

	const user: TestUser = {
		id: overrides.id ?? uniqueId,
		email: overrides.email ?? `e2e-test-${timestamp}@example.com`,
		password: overrides.password ?? "TestPassword123!",
		name: overrides.name ?? "E2E Test User",
	};

	// Insert into user table (BetterAuth schema)
	await client.query(
		`INSERT INTO "user" ("id", "email", "name", "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, NOW(), NOW())`,
		[user.id, user.email, user.name],
	);

	// BetterAuth stores passwords in the account table
	// For email/password auth, we need to create an account entry
	// The password is hashed by BetterAuth, but for E2E tests we'll
	// use the signup API instead to properly hash the password

	return user;
}

/**
 * Create a test user via the BetterAuth API
 *
 * This is the preferred method for E2E tests as it properly
 * hashes the password and sets up all required tables.
 *
 * @param baseUrl - The base URL of the application
 * @param user - User data to create
 * @returns Response from the signup API
 */
export async function createTestUserViaAPI(
	baseUrl: string,
	user: { email: string; password: string; name: string },
): Promise<{ success: boolean; error?: string }> {
	try {
		const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				email: user.email,
				password: user.password,
				name: user.name,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			return { success: false, error };
		}

		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Clean up test users from the database
 *
 * @param client - Database client
 * @param pattern - Email pattern to match (default: e2e-test-%)
 */
export async function cleanupTestUsers(
	client: PoolClient | Pool,
	pattern = "e2e-test-%@example.com",
): Promise<void> {
	// Delete sessions first (foreign key constraint)
	await client.query(
		`DELETE FROM "session" WHERE "userId" IN (
       SELECT id FROM "user" WHERE email LIKE $1
     )`,
		[pattern],
	);

	// Delete accounts (foreign key constraint)
	await client.query(
		`DELETE FROM "account" WHERE "userId" IN (
       SELECT id FROM "user" WHERE email LIKE $1
     )`,
		[pattern],
	);

	// Delete users
	await client.query(`DELETE FROM "user" WHERE email LIKE $1`, [pattern]);
}
