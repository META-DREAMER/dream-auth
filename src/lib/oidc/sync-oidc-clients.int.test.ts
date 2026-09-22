/**
 * Integration tests for OIDC client seeding to database.
 *
 * These tests use testcontainers to spin up a real PostgreSQL database.
 * Run with: pnpm test:integration
 *
 * Unlike the pre-1.7 version of this file, the schema is not hand-written
 * here. A real Better Auth instance with `@better-auth/oauth-provider` runs
 * its own migrations, and the seeder writes through that instance's adapter.
 * That makes the test assert against the actual `oauthClient` table - column
 * names, array serialization and the JSON `metadata` column included - rather
 * than against a fixture that can silently drift from the library.
 *
 * The skipIfNoDb check is a safety net - when running via the integration
 * config (vitest.integration.config.ts), testcontainers will start a
 * PostgreSQL container and set DATABASE_URL before these tests run.
 */

import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { jwt } from "better-auth/plugins";
import { Pool } from "pg";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { hashClientSecret } from "./hash-client-secret";
import { type OidcClientConfig, oidcClientSchema } from "./schemas";

// We need to mock the env module before importing the sync module
// Use a getter so DATABASE_URL is read dynamically at access time,
// after testcontainers has started and set the env var
vi.mock("@/env", () => ({
	serverEnv: {
		get DATABASE_URL() {
			return (
				process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test"
			);
		},
		OIDC_REQUIRE_PKCE: true,
	},
}));

import {
	_resetSeedingState,
	ensureOidcClientsSeeded,
	type OidcSeedAdapter,
} from "./sync-oidc-clients";

describe("OIDC Client Sync Integration Tests", () => {
	let pool: Pool;
	let adapter: OidcSeedAdapter;

	// Safety net: skip if no real database is available
	// INTEGRATION_TEST_DB_READY is set by test/setup-db.ts after testcontainers starts
	const skipIfNoDb = !process.env.INTEGRATION_TEST_DB_READY;

	/** Seed with the test adapter, bypassing the app's own auth singleton. */
	const seed = (clients: OidcClientConfig[]) =>
		ensureOidcClientsSeeded(clients, { adapter, requirePKCE: true });

	beforeAll(async () => {
		if (skipIfNoDb) return;

		pool = new Pool({ connectionString: process.env.DATABASE_URL });

		// A real Better Auth instance owns the schema, so the table this test
		// asserts on is the one the plugin actually reads at runtime.
		const testAuth = betterAuth({
			database: pool,
			baseURL: "http://localhost:3000",
			secret: "integration-test-secret-at-least-32-characters",
			plugins: [
				jwt(),
				oauthProvider({
					loginPage: "/login",
					consentPage: "/consent",
					storeClientSecret: { hash: hashClientSecret },
				}),
			],
		});

		const migrations = await getMigrations(testAuth.options);
		await migrations.runMigrations();

		const context = await testAuth.$context;
		adapter = context.adapter as unknown as OidcSeedAdapter;
	}, 120_000);

	afterAll(async () => {
		if (skipIfNoDb) return;
		await pool?.end();
	});

	beforeEach(async () => {
		if (skipIfNoDb) return;

		await pool.query('DELETE FROM "oauthClient"');
		_resetSeedingState();

		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	const validClient: OidcClientConfig = oidcClientSchema.parse({
		clientId: "test-app",
		name: "Test Application",
		clientSecret: "super-secret-key",
		redirectURLs: ["https://app.example.com/callback"],
	});

	it.skipIf(skipIfNoDb)("seeds a single client to database", async () => {
		await seed([validClient]);

		const result = await pool.query(
			'SELECT * FROM "oauthClient" WHERE "clientId" = $1',
			["test-app"],
		);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].clientId).toBe("test-app");
		expect(result.rows[0].name).toBe("Test Application");
		expect(result.rows[0].applicationType).toBe("web");
		expect(result.rows[0].tokenEndpointAuthMethod).toBe("client_secret_basic");
	});

	it.skipIf(skipIfNoDb)(
		"stores the client secret hashed, never in plain text",
		async () => {
			await seed([validClient]);

			const result = await pool.query(
				'SELECT "clientSecret" FROM "oauthClient" WHERE "clientId" = $1',
				["test-app"],
			);

			expect(result.rows[0].clientSecret).not.toBe("super-secret-key");
			expect(result.rows[0].clientSecret).toBe(
				hashClientSecret("super-secret-key"),
			);
		},
	);

	it.skipIf(skipIfNoDb)("seeds multiple clients", async () => {
		await seed([
			validClient,
			{ ...validClient, clientId: "app-2", name: "App Two" },
			{ ...validClient, clientId: "app-3", name: "App Three" },
		]);

		const result = await pool.query('SELECT * FROM "oauthClient"');

		expect(result.rows).toHaveLength(3);
		expect(result.rows.map((r) => r.clientId).sort()).toEqual([
			"app-2",
			"app-3",
			"test-app",
		]);
	});

	it.skipIf(skipIfNoDb)("updates existing client (upsert)", async () => {
		await seed([validClient]);
		_resetSeedingState();

		await seed([
			{
				...validClient,
				name: "Updated Name",
				redirectURLs: ["https://new-url.example.com/callback"],
			},
		]);

		const result = await pool.query(
			'SELECT * FROM "oauthClient" WHERE "clientId" = $1',
			["test-app"],
		);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].name).toBe("Updated Name");
	});

	it.skipIf(skipIfNoDb)(
		"round-trips redirect URLs through the adapter",
		async () => {
			const urls = [
				"https://app1.example.com/callback",
				"https://app2.example.com/callback",
				"http://localhost:3000/callback",
			];

			await seed([{ ...validClient, redirectURLs: urls }]);

			// Read back through the adapter, which owns the array encoding.
			const row = await adapter.findOne<{ redirectUris: string[] }>({
				model: "oauthClient",
				where: [{ field: "clientId", value: "test-app" }],
			});

			expect(row?.redirectUris).toEqual(urls);
		},
	);

	it.skipIf(skipIfNoDb)("round-trips grant and response types", async () => {
		await seed([validClient]);

		const row = await adapter.findOne<{
			grantTypes: string[];
			responseTypes: string[];
		}>({
			model: "oauthClient",
			where: [{ field: "clientId", value: "test-app" }],
		});

		expect(row?.grantTypes).toEqual(["authorization_code", "refresh_token"]);
		expect(row?.responseTypes).toEqual(["code"]);
	});

	it.skipIf(skipIfNoDb)("stores metadata as JSON", async () => {
		await seed([
			{ ...validClient, metadata: { custom: "value", nested: { key: "val" } } },
		]);

		const row = await adapter.findOne<{ metadata: unknown }>({
			model: "oauthClient",
			where: [{ field: "clientId", value: "test-app" }],
		});

		const metadata =
			typeof row?.metadata === "string"
				? JSON.parse(row.metadata)
				: row?.metadata;

		expect(metadata).toEqual({ custom: "value", nested: { key: "val" } });
	});

	it.skipIf(skipIfNoDb)(
		"singleton promise prevents duplicate seeding",
		async () => {
			await Promise.all([seed([validClient]), seed([validClient])]);

			const result = await pool.query('SELECT * FROM "oauthClient"');
			expect(result.rows).toHaveLength(1);
		},
	);

	it.skipIf(skipIfNoDb)("skips seeding when no clients provided", async () => {
		await seed([]);

		const result = await pool.query('SELECT * FROM "oauthClient"');
		expect(result.rows).toHaveLength(0);

		expect(console.log).toHaveBeenCalledWith(
			"[OIDC] No clients configured, skipping DB seeding",
		);
	});

	it.skipIf(skipIfNoDb)("handles public client without secret", async () => {
		await seed([
			oidcClientSchema.parse({
				clientId: "public-app",
				name: "Public Application",
				tokenEndpointAuthMethod: "none",
				redirectURLs: ["https://spa.example.com/callback"],
			}),
		]);

		const result = await pool.query(
			'SELECT * FROM "oauthClient" WHERE "clientId" = $1',
			["public-app"],
		);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].clientSecret).toBeNull();
		expect(result.rows[0].tokenEndpointAuthMethod).toBe("none");
	});

	it.skipIf(skipIfNoDb)(
		"writes the PKCE requirement onto the row",
		async () => {
			_resetSeedingState();
			await ensureOidcClientsSeeded([validClient], {
				adapter,
				requirePKCE: false,
			});

			const result = await pool.query(
				'SELECT "requirePKCE" FROM "oauthClient" WHERE "clientId" = $1',
				["test-app"],
			);

			expect(result.rows[0].requirePKCE).toBe(false);
		},
	);

	describe("validation errors", () => {
		it.skipIf(skipIfNoDb)("throws on invalid redirect URL", async () => {
			await expect(
				seed([{ ...validClient, redirectURLs: ["not-a-valid-url"] }]),
			).rejects.toThrow(/Invalid redirect URL/);
		});

		it.skipIf(skipIfNoDb)(
			"throws when a confidential client is missing its secret",
			async () => {
				await expect(
					seed([{ ...validClient, clientSecret: undefined }]),
				).rejects.toThrow(/clientSecret is required/);
			},
		);

		it.skipIf(skipIfNoDb)("throws on duplicate clientIds", async () => {
			await expect(
				seed([validClient, { ...validClient, name: "Duplicate" }]),
			).rejects.toThrow(/Duplicate clientIds/);
		});

		it.skipIf(skipIfNoDb)("throws on empty redirectURLs", async () => {
			await expect(
				seed([{ ...validClient, redirectURLs: [] }]),
			).rejects.toThrow(/At least one redirect URL/);
		});

		it.skipIf(skipIfNoDb)(
			"validates every client before writing any of them",
			async () => {
				await expect(
					seed([
						validClient,
						{
							...validClient,
							clientId: "invalid-app",
							redirectURLs: ["invalid-url"],
						},
					]),
				).rejects.toThrow();

				// Validation runs as a batch up front, so nothing was written.
				const result = await pool.query('SELECT * FROM "oauthClient"');
				expect(result.rows).toHaveLength(0);
			},
		);
	});
});
