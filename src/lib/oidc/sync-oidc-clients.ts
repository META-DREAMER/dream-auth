/**
 * OIDC Client DB Seeding Module
 *
 * This module ensures configured OIDC clients are persisted to the oauthApplication
 * table before any OIDC token operations occur. This fixes the FK constraint failure
 * described in Better Auth issue #6649 where trustedClients are validated in-memory
 * but not persisted to the database.
 *
 * @see https://github.com/better-auth/better-auth/issues/6649
 */

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { serverEnv } from "@/env";
import type { OidcClientConfig } from "./schemas";

/**
 * Validation errors for OIDC client configuration
 */
class OidcClientValidationError extends Error {
	constructor(
		public clientId: string,
		public field: string,
		message: string,
	) {
		super(`[OIDC] Client "${clientId}" validation failed: ${message}`);
		this.name = "OidcClientValidationError";
	}
}

/**
 * Validate an OIDC client configuration for database insertion.
 * Mirrors the validation logic in Better Auth's registerOAuthApplication endpoint.
 *
 * @throws OidcClientValidationError if validation fails
 */
function validateOidcClientForDb(client: OidcClientConfig): void {
	// Validate redirectURLs are not empty (required for authorization_code flow)
	if (!client.redirectURLs || client.redirectURLs.length === 0) {
		throw new OidcClientValidationError(
			client.clientId,
			"redirectURLs",
			"At least one redirect URL is required for authorization_code flow",
		);
	}

	// Validate each redirect URL is a valid URL
	for (const url of client.redirectURLs) {
		try {
			new URL(url);
		} catch {
			throw new OidcClientValidationError(
				client.clientId,
				"redirectURLs",
				`Invalid redirect URL: ${url}`,
			);
		}
	}

	// Validate clientSecret is present for non-public clients
	if (client.type !== "public" && !client.clientSecret) {
		throw new OidcClientValidationError(
			client.clientId,
			"clientSecret",
			"clientSecret is required for non-public clients",
		);
	}

	// Validate clientId is not empty
	if (!client.clientId || client.clientId.trim() === "") {
		throw new OidcClientValidationError(
			client.clientId || "(empty)",
			"clientId",
			"clientId cannot be empty",
		);
	}

	// Validate name is not empty
	if (!client.name || client.name.trim() === "") {
		throw new OidcClientValidationError(
			client.clientId,
			"name",
			"name cannot be empty",
		);
	}
}

/**
 * Upsert a single OIDC client into the oauthApplication table.
 * Uses INSERT...ON CONFLICT DO UPDATE for idempotency.
 *
 * Note: Table and column names use snake_case as per Better Auth's default
 * PostgreSQL adapter behavior with the Kysely adapter.
 */
async function upsertOidcClient(
	dbClient: PoolClient,
	client: OidcClientConfig,
): Promise<void> {
	const now = new Date();

	// Prepare metadata as JSON string (or null)
	const metadataJson = client.metadata ? JSON.stringify(client.metadata) : null;

	// Join redirectURLs as comma-separated string (Better Auth format)
	const redirectUrls = client.redirectURLs.join(",");

	// Use INSERT...ON CONFLICT for idempotent upsert
	// Note: Better Auth uses camelCase column names with the built-in Kysely adapter
	await dbClient.query(
		`
		INSERT INTO "oauthApplication" (
			"id",
			"clientId",
			"clientSecret",
			"name",
			"icon",
			"redirectUrls",
			"metadata",
			"type",
			"disabled",
			"userId",
			"createdAt",
			"updatedAt"
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT ("clientId") DO UPDATE SET
			"clientSecret" = EXCLUDED."clientSecret",
			"name" = EXCLUDED."name",
			"icon" = EXCLUDED."icon",
			"redirectUrls" = EXCLUDED."redirectUrls",
			"metadata" = EXCLUDED."metadata",
			"type" = EXCLUDED."type",
			"disabled" = EXCLUDED."disabled",
			"userId" = EXCLUDED."userId",
			"updatedAt" = EXCLUDED."updatedAt"
		`,
		[
			randomUUID(), // id - generated for new records, ignored on conflict
			client.clientId,
			client.clientSecret || null,
			client.name,
			client.icon || null,
			redirectUrls,
			metadataJson,
			client.type,
			client.disabled ?? false,
			client.userId || null,
			now, // createdAt - only used for new records
			now, // updatedAt - always updated
		],
	);
}

/**
 * Singleton promise to ensure seeding only runs once per process.
 * This handles concurrent startup scenarios (multiple pods, hot reload).
 */
let seedingPromise: Promise<void> | null = null;

/**
 * Ensure all configured OIDC clients are seeded into the database.
 * This function is idempotent and safe to call multiple times.
 *
 * Call this before any OIDC token operations to ensure FK constraints are satisfied.
 *
 * @param pool - PostgreSQL connection pool
 * @param clients - Array of OIDC client configurations to seed
 */
export async function ensureOidcClientsSeeded(
	clients: OidcClientConfig[],
): Promise<void> {
	// Return existing promise if seeding is already in progress or complete
	if (seedingPromise) {
		return seedingPromise;
	}

	// Skip if no clients configured
	if (!clients || clients.length === 0) {
		console.log("[OIDC] No clients configured, skipping DB seeding");
		seedingPromise = Promise.resolve();
		return seedingPromise;
	}

	seedingPromise = performSeeding(clients);
	return seedingPromise;
}

/**
 * Internal function to perform the actual seeding operation.
 * Runs in a transaction for atomicity.
 */
async function performSeeding(clients: OidcClientConfig[]): Promise<void> {
	// Log client IDs but NEVER log secrets
	console.log(
		`[OIDC] Seeding ${clients.length} client(s) to database: ${clients.map((c) => c.clientId).join(", ")}`,
	);

	// Validate all clients before attempting DB operations
	const validationErrors: OidcClientValidationError[] = [];
	for (const client of clients) {
		try {
			validateOidcClientForDb(client);
		} catch (e) {
			if (e instanceof OidcClientValidationError) {
				validationErrors.push(e);
			} else {
				throw e;
			}
		}
	}

	if (validationErrors.length > 0) {
		const errorMessages = validationErrors.map((e) => e.message).join("; ");
		throw new Error(`[OIDC] Client validation failed: ${errorMessages}`);
	}

	// Check for duplicate clientIds
	const clientIds = clients.map((c) => c.clientId);
	const duplicates = clientIds.filter(
		(id, index) => clientIds.indexOf(id) !== index,
	);
	if (duplicates.length > 0) {
		throw new Error(
			`[OIDC] Duplicate clientIds in configuration: ${[...new Set(duplicates)].join(", ")}`,
		);
	}

	// Acquire a client from the pool for the transaction
	const pool = new Pool({
		connectionString: serverEnv.DATABASE_URL,
	});
	const dbClient = await pool.connect();

	try {
		// Begin transaction
		await dbClient.query("BEGIN");

		// Upsert each client
		for (const client of clients) {
			await upsertOidcClient(dbClient, client);
		}

		// Commit transaction
		await dbClient.query("COMMIT");

		console.log(
			`[OIDC] Successfully seeded ${clients.length} client(s) to database`,
		);
	} catch (error) {
		// Rollback on any error
		await dbClient.query("ROLLBACK");
		console.error("[OIDC] Failed to seed clients to database:", error);
		throw error;
	} finally {
		// Always release the client back to the pool
		dbClient.release();
		await pool.end();
	}
}

/**
 * Reset the seeding state. Only for testing purposes.
 * @internal
 */
export function _resetSeedingState(): void {
	seedingPromise = null;
}
