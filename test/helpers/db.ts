import type { Pool } from "pg";

/**
 * Database helper utilities for integration tests
 */

/**
 * Clean up all test data from the database
 * Tables are truncated in order to respect FK constraints
 */
export async function cleanupDatabase(pool: Pool): Promise<void> {
	// Order matters due to FK constraints - child tables first
	const tables = [
		"session",
		"account",
		"verification",
		"member",
		"invitation",
		"team",
		"organization",
		"oauthApplication",
		"user",
	];

	for (const table of tables) {
		await pool.query(`TRUNCATE TABLE "${table}" CASCADE`);
	}
}

/**
 * Seed a test user into the database
 * @returns The user ID
 */
export async function seedTestUser(
	pool: Pool,
	options?: {
		email?: string;
		name?: string;
		emailVerified?: boolean;
	},
): Promise<string> {
	const email = options?.email ?? "test@example.com";
	const name = options?.name ?? "Test User";
	const emailVerified = options?.emailVerified ?? true;

	const result = await pool.query(
		`
    INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
    RETURNING id
  `,
		[email, name, emailVerified],
	);

	return result.rows[0].id;
}

/**
 * Seed a test organization into the database
 * @returns The organization ID
 */
export async function seedTestOrganization(
	pool: Pool,
	options?: {
		name?: string;
		slug?: string;
	},
): Promise<string> {
	const name = options?.name ?? "Test Organization";
	const slug = options?.slug ?? "test-org";

	const result = await pool.query(
		`
    INSERT INTO "organization" (id, name, slug, "createdAt")
    VALUES (gen_random_uuid(), $1, $2, NOW())
    RETURNING id
  `,
		[name, slug],
	);

	return result.rows[0].id;
}

/**
 * Seed a pending invitation into the database
 * @returns The invitation ID
 */
export async function seedTestInvitation(
	pool: Pool,
	options: {
		email: string;
		organizationId: string;
		inviterId: string;
		role?: string;
		expiresAt?: Date;
		walletAddress?: string | null;
	},
): Promise<string> {
	const role = options.role ?? "member";
	const expiresAt = options.expiresAt ?? new Date(Date.now() + 7 * 86400000); // 7 days

	const result = await pool.query(
		`
    INSERT INTO "invitation"
    (id, email, "organizationId", role, status, "inviterId", "expiresAt")
    VALUES (gen_random_uuid(), $1, $2, $3, 'pending', $4, $5)
    RETURNING id
  `,
		[options.email, options.organizationId, role, options.inviterId, expiresAt],
	);

	return result.rows[0].id;
}

/**
 * Get OIDC application by client ID
 */
export async function getOidcApplication(
	pool: Pool,
	clientId: string,
): Promise<Record<string, unknown> | null> {
	const result = await pool.query(
		`SELECT * FROM "oauthApplication" WHERE "clientId" = $1`,
		[clientId],
	);

	return result.rows[0] ?? null;
}

/**
 * Count OIDC applications in database
 */
export async function countOidcApplications(pool: Pool): Promise<number> {
	const result = await pool.query(
		`SELECT COUNT(*) as count FROM "oauthApplication"`,
	);
	return Number.parseInt(result.rows[0].count, 10);
}
