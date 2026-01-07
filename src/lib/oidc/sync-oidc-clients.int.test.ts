/**
 * Integration tests for OIDC client seeding to database.
 * These tests require a PostgreSQL database (via testcontainers).
 */

import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OidcClientConfig } from "./schemas";

// We need to mock the env module before importing the sync module
vi.mock("@/env", () => ({
	serverEnv: {
		DATABASE_URL:
			process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test",
	},
}));

import {
	_resetSeedingState,
	ensureOidcClientsSeeded,
} from "./sync-oidc-clients";

describe("OIDC Client Sync Integration Tests", () => {
	let pool: Pool;

	// Skip tests if no DATABASE_URL is provided (CI will provide it)
	const skipIfNoDb = !process.env.DATABASE_URL;

	beforeEach(async () => {
		if (skipIfNoDb) return;

		pool = new Pool({
			connectionString: process.env.DATABASE_URL,
		});

		// Create the oauthApplication table if it doesn't exist
		await pool.query(`
			CREATE TABLE IF NOT EXISTS "oauthApplication" (
				"id" TEXT PRIMARY KEY,
				"clientId" TEXT UNIQUE NOT NULL,
				"clientSecret" TEXT,
				"name" TEXT NOT NULL,
				"icon" TEXT,
				"redirectUrls" TEXT NOT NULL,
				"metadata" TEXT,
				"type" TEXT NOT NULL DEFAULT 'web',
				"disabled" BOOLEAN DEFAULT FALSE,
				"userId" TEXT,
				"createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				"updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
			)
		`);

		// Clear the table before each test
		await pool.query('DELETE FROM "oauthApplication"');

		// Reset the singleton state
		_resetSeedingState();

		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(async () => {
		if (skipIfNoDb) return;

		vi.restoreAllMocks();
		await pool?.end();
	});

	const validClient: OidcClientConfig = {
		clientId: "test-app",
		name: "Test Application",
		clientSecret: "super-secret-key",
		redirectURLs: ["https://app.example.com/callback"],
		type: "web",
		skipConsent: false,
		disabled: false,
	};

	it.skipIf(skipIfNoDb)("seeds a single client to database", async () => {
		await ensureOidcClientsSeeded([validClient]);

		const result = await pool.query(
			'SELECT * FROM "oauthApplication" WHERE "clientId" = $1',
			["test-app"],
		);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].clientId).toBe("test-app");
		expect(result.rows[0].name).toBe("Test Application");
		expect(result.rows[0].type).toBe("web");
	});

	it.skipIf(skipIfNoDb)("seeds multiple clients in transaction", async () => {
		const clients: OidcClientConfig[] = [
			validClient,
			{
				...validClient,
				clientId: "app-2",
				name: "App Two",
			},
			{
				...validClient,
				clientId: "app-3",
				name: "App Three",
			},
		];

		await ensureOidcClientsSeeded(clients);

		const result = await pool.query('SELECT * FROM "oauthApplication"');

		expect(result.rows).toHaveLength(3);
		expect(result.rows.map((r) => r.clientId).sort()).toEqual([
			"app-2",
			"app-3",
			"test-app",
		]);
	});

	it.skipIf(skipIfNoDb)("updates existing client (upsert)", async () => {
		// First insert
		await ensureOidcClientsSeeded([validClient]);

		// Reset state to allow re-seeding
		_resetSeedingState();

		// Update the client
		const updatedClient: OidcClientConfig = {
			...validClient,
			name: "Updated Name",
			redirectURLs: ["https://new-url.example.com/callback"],
		};

		await ensureOidcClientsSeeded([updatedClient]);

		const result = await pool.query(
			'SELECT * FROM "oauthApplication" WHERE "clientId" = $1',
			["test-app"],
		);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].name).toBe("Updated Name");
		expect(result.rows[0].redirectUrls).toBe(
			"https://new-url.example.com/callback",
		);
	});

	it.skipIf(skipIfNoDb)(
		"singleton promise prevents duplicate seeding",
		async () => {
			// Call seeding twice simultaneously
			const promise1 = ensureOidcClientsSeeded([validClient]);
			const promise2 = ensureOidcClientsSeeded([validClient]);

			await Promise.all([promise1, promise2]);

			// Should still only have one record
			const result = await pool.query('SELECT * FROM "oauthApplication"');
			expect(result.rows).toHaveLength(1);
		},
	);

	it.skipIf(skipIfNoDb)("skips seeding when no clients provided", async () => {
		await ensureOidcClientsSeeded([]);

		const result = await pool.query('SELECT * FROM "oauthApplication"');
		expect(result.rows).toHaveLength(0);

		expect(console.log).toHaveBeenCalledWith(
			"[OIDC] No clients configured, skipping DB seeding",
		);
	});

	it.skipIf(skipIfNoDb)("stores redirect URLs as comma-separated", async () => {
		const clientWithMultipleUrls: OidcClientConfig = {
			...validClient,
			redirectURLs: [
				"https://app1.example.com/callback",
				"https://app2.example.com/callback",
				"http://localhost:3000/callback",
			],
		};

		await ensureOidcClientsSeeded([clientWithMultipleUrls]);

		const result = await pool.query(
			'SELECT "redirectUrls" FROM "oauthApplication" WHERE "clientId" = $1',
			["test-app"],
		);

		expect(result.rows[0].redirectUrls).toBe(
			"https://app1.example.com/callback,https://app2.example.com/callback,http://localhost:3000/callback",
		);
	});

	it.skipIf(skipIfNoDb)("stores metadata as JSON string", async () => {
		const clientWithMetadata: OidcClientConfig = {
			...validClient,
			metadata: { custom: "value", nested: { key: "val" } },
		};

		await ensureOidcClientsSeeded([clientWithMetadata]);

		const result = await pool.query(
			'SELECT "metadata" FROM "oauthApplication" WHERE "clientId" = $1',
			["test-app"],
		);

		expect(JSON.parse(result.rows[0].metadata)).toEqual({
			custom: "value",
			nested: { key: "val" },
		});
	});

	it.skipIf(skipIfNoDb)("handles public client without secret", async () => {
		const publicClient: OidcClientConfig = {
			clientId: "public-app",
			name: "Public Application",
			type: "public",
			redirectURLs: ["https://spa.example.com/callback"],
			skipConsent: false,
			disabled: false,
		};

		await ensureOidcClientsSeeded([publicClient]);

		const result = await pool.query(
			'SELECT * FROM "oauthApplication" WHERE "clientId" = $1',
			["public-app"],
		);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].clientSecret).toBeNull();
		expect(result.rows[0].type).toBe("public");
	});

	describe("validation errors", () => {
		it.skipIf(skipIfNoDb)("throws on invalid redirect URL", async () => {
			const clientWithInvalidUrl: OidcClientConfig = {
				...validClient,
				redirectURLs: ["not-a-valid-url"],
			};

			await expect(
				ensureOidcClientsSeeded([clientWithInvalidUrl]),
			).rejects.toThrow(/Invalid redirect URL/);
		});

		it.skipIf(skipIfNoDb)(
			"throws when non-public client missing secret",
			async () => {
				const clientWithoutSecret: OidcClientConfig = {
					clientId: "web-no-secret",
					name: "Web Without Secret",
					type: "web",
					redirectURLs: ["https://app.example.com/callback"],
					skipConsent: false,
					disabled: false,
				};

				await expect(
					ensureOidcClientsSeeded([clientWithoutSecret]),
				).rejects.toThrow(/clientSecret is required/);
			},
		);

		it.skipIf(skipIfNoDb)("throws on duplicate clientIds", async () => {
			const duplicateClients: OidcClientConfig[] = [
				validClient,
				{ ...validClient, name: "Duplicate" },
			];

			await expect(ensureOidcClientsSeeded(duplicateClients)).rejects.toThrow(
				/Duplicate clientIds/,
			);
		});

		it.skipIf(skipIfNoDb)("throws on empty redirectURLs", async () => {
			const clientWithNoUrls: OidcClientConfig = {
				...validClient,
				redirectURLs: [],
			};

			await expect(ensureOidcClientsSeeded([clientWithNoUrls])).rejects.toThrow(
				/At least one redirect URL/,
			);
		});
	});

	describe("transaction rollback", () => {
		it.skipIf(skipIfNoDb)(
			"rolls back on validation error (no partial inserts)",
			async () => {
				const clients: OidcClientConfig[] = [
					validClient,
					{
						...validClient,
						clientId: "invalid-app",
						redirectURLs: ["invalid-url"],
					},
				];

				await expect(ensureOidcClientsSeeded(clients)).rejects.toThrow();

				// Table should be empty (rolled back)
				const result = await pool.query('SELECT * FROM "oauthApplication"');
				expect(result.rows).toHaveLength(0);
			},
		);
	});
});
