import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
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
 * Create a password user directly in the database.
 *
 * Password sign-up is off (`emailAndPassword.disableSignUp`), but password
 * accounts made before that still sign in with their password, so tests
 * insert them the way better-auth stores them: a verified `user` row plus a
 * `credential` account holding a better-auth password hash.
 *
 * @param client - Database client
 * @param overrides - Optional overrides for user properties
 * @returns Created test user with credentials
 */
export async function createTestUser(
	client: PoolClient | Pool,
	overrides: Partial<TestUser> = {},
): Promise<TestUser> {
	const user: TestUser = {
		id: overrides.id || randomUUID(),
		email: overrides.email ?? `e2e-test-${Date.now()}@example.com`,
		password: overrides.password ?? "TestPassword123!",
		name: overrides.name ?? "E2E Test User",
	};

	await client.query(
		`INSERT INTO "user" ("id", "email", "name", "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, NOW(), NOW())`,
		[user.id, user.email.toLowerCase(), user.name],
	);
	await client.query(
		`INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
     VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
		[randomUUID(), user.id, await hashPassword(user.password)],
	);

	return user;
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
