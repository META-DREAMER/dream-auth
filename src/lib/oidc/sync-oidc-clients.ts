/**
 * OIDC Client DB Seeding Module
 *
 * Persists the OIDC clients from configuration (`OIDC_CLIENTS`,
 * `OIDC_CLIENTS_FILE`) into the `oauthClient` table.
 *
 * Since Better Auth 1.7 this is the *only* way to register a config-driven
 * client: `@better-auth/oauth-provider` dropped the `trustedClients` option
 * that `oidcProvider` had, so every client - including a trusted one that skips
 * consent - must exist as a database row. `cachedTrustedClients` on the plugin
 * only controls caching of those rows, it does not define them.
 *
 * Rows are written through the Better Auth database adapter rather than raw
 * SQL, so array columns (`redirectUris`, `grantTypes`, ...) and the JSON
 * `metadata` column are serialized exactly the way the plugin reads them back.
 */

import { serverEnv } from "@/env";
import { hashClientSecret } from "./hash-client-secret";
import type { OidcClientConfig } from "./schemas";

/** The model name of the client table (`oauthApplication` before 1.7). */
export const OAUTH_CLIENT_MODEL = "oauthClient";

type Where = { field: string; value: unknown };

/**
 * The slice of the Better Auth database adapter this module needs.
 *
 * Declared structurally so tests can supply a real adapter from a test
 * Better Auth instance without depending on the app's own `auth` singleton.
 */
export interface OidcSeedAdapter {
	findOne<T>(data: { model: string; where: Where[] }): Promise<T | null>;
	create<T extends Record<string, unknown>>(data: {
		model: string;
		data: Record<string, unknown>;
	}): Promise<T>;
	update<T>(data: {
		model: string;
		where: Where[];
		update: Record<string, unknown>;
	}): Promise<T | null>;
}

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
 * Validate an OIDC client configuration before it is written to the database.
 *
 * @throws OidcClientValidationError if validation fails
 */
function validateOidcClientForDb(client: OidcClientConfig): void {
	if (!client.clientId || client.clientId.trim() === "") {
		throw new OidcClientValidationError(
			client.clientId || "(empty)",
			"clientId",
			"clientId cannot be empty",
		);
	}

	if (!client.name || client.name.trim() === "") {
		throw new OidcClientValidationError(
			client.clientId,
			"name",
			"name cannot be empty",
		);
	}

	if (!client.redirectURLs || client.redirectURLs.length === 0) {
		throw new OidcClientValidationError(
			client.clientId,
			"redirectURLs",
			"At least one redirect URL is required for authorization_code flow",
		);
	}

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

	if (client.tokenEndpointAuthMethod !== "none" && !client.clientSecret) {
		throw new OidcClientValidationError(
			client.clientId,
			"clientSecret",
			`clientSecret is required for tokenEndpointAuthMethod "${client.tokenEndpointAuthMethod}"`,
		);
	}

	if (!client.grantTypes || client.grantTypes.length === 0) {
		throw new OidcClientValidationError(
			client.clientId,
			"grantTypes",
			"At least one grant type is required",
		);
	}

	if (!client.responseTypes || client.responseTypes.length === 0) {
		throw new OidcClientValidationError(
			client.clientId,
			"responseTypes",
			"At least one response type is required",
		);
	}
}

/**
 * Build the `oauthClient` row for a configured client.
 *
 * `clientSecret` is hashed with {@link hashClientSecret}, which is also what
 * the plugin is configured to use, so the stored value verifies against the
 * secret the downstream app presents.
 */
export function toOauthClientRow(
	client: OidcClientConfig,
	options: { requirePKCE: boolean },
): Record<string, unknown> {
	const now = new Date();

	return {
		clientId: client.clientId,
		clientSecret: client.clientSecret
			? hashClientSecret(client.clientSecret)
			: null,
		name: client.name,
		icon: client.icon ?? null,
		redirectUris: client.redirectURLs,
		grantTypes: client.grantTypes,
		responseTypes: client.responseTypes,
		applicationType: client.applicationType,
		tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
		skipConsent: client.skipConsent,
		disabled: client.disabled,
		// `requirePKCE` defaults to true inside the plugin, so OIDC_REQUIRE_PKCE
		// has to be written onto every row to be able to turn it off.
		requirePKCE: client.requirePKCE ?? options.requirePKCE,
		// A real JSON column since 1.7 - pass the object, not a JSON string.
		metadata: client.metadata ?? null,
		// `null` means "every scope the provider supports".
		scopes: client.scopes ?? null,
		userId: client.userId ?? null,
		createdAt: now,
		updatedAt: now,
	};
}

/** Columns that are only meaningful when the row is first inserted. */
const INSERT_ONLY_FIELDS = ["createdAt"] as const;

function toUpdatePayload(
	row: Record<string, unknown>,
): Record<string, unknown> {
	const update = { ...row };
	for (const field of INSERT_ONLY_FIELDS) {
		delete update[field];
	}
	return update;
}

function isUniqueViolation(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const code = (error as { code?: unknown }).code;
	if (code === "23505") return true;
	const message = error instanceof Error ? error.message : String(error);
	return /duplicate key|unique constraint/i.test(message);
}

/**
 * Insert or update one client row.
 *
 * Two pods can race on first boot, so a unique-key violation on insert falls
 * back to an update rather than failing startup.
 */
async function upsertOidcClient(
	adapter: OidcSeedAdapter,
	client: OidcClientConfig,
	options: { requirePKCE: boolean },
): Promise<void> {
	const row = toOauthClientRow(client, options);
	const where: Where[] = [{ field: "clientId", value: client.clientId }];

	const existing = await adapter.findOne<{ id: string }>({
		model: OAUTH_CLIENT_MODEL,
		where,
	});

	if (existing) {
		await adapter.update({
			model: OAUTH_CLIENT_MODEL,
			where,
			update: toUpdatePayload(row),
		});
		return;
	}

	try {
		await adapter.create({ model: OAUTH_CLIENT_MODEL, data: row });
	} catch (error) {
		if (!isUniqueViolation(error)) throw error;
		await adapter.update({
			model: OAUTH_CLIENT_MODEL,
			where,
			update: toUpdatePayload(row),
		});
	}
}

/**
 * Singleton promise to ensure seeding only runs once per process.
 * This handles concurrent startup scenarios (multiple pods, hot reload).
 */
let seedingPromise: Promise<void> | null = null;

/**
 * Resolve the app's Better Auth database adapter.
 *
 * Imported lazily so this module can be unit-tested with a fake adapter
 * without constructing the whole auth instance.
 */
async function getAppAdapter(): Promise<OidcSeedAdapter> {
	const { auth } = await import("@/lib/auth");
	const context = await auth.$context;
	return context.adapter as unknown as OidcSeedAdapter;
}

/**
 * Ensure all configured OIDC clients are seeded into the database.
 * This function is idempotent and safe to call multiple times.
 *
 * Must run after the Better Auth migrations have created `oauthClient`.
 *
 * @param clients - Array of OIDC client configurations to seed
 * @param overrides - Test seam for the adapter and the PKCE default
 */
export async function ensureOidcClientsSeeded(
	clients: OidcClientConfig[],
	overrides?: { adapter?: OidcSeedAdapter; requirePKCE?: boolean },
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

	seedingPromise = performSeeding(clients, overrides).catch((error) => {
		// Clear cache on failure so retries can attempt seeding again
		// This handles the case where seeding fails before migrations run
		seedingPromise = null;
		throw error;
	});
	return seedingPromise;
}

/**
 * Internal function to perform the actual seeding operation.
 */
async function performSeeding(
	clients: OidcClientConfig[],
	overrides?: { adapter?: OidcSeedAdapter; requirePKCE?: boolean },
): Promise<void> {
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

	const adapter = overrides?.adapter ?? (await getAppAdapter());
	const requirePKCE = overrides?.requirePKCE ?? serverEnv.OIDC_REQUIRE_PKCE;

	try {
		for (const client of clients) {
			await upsertOidcClient(adapter, client, { requirePKCE });
		}
	} catch (error) {
		console.error("[OIDC] Failed to seed clients to database:", error);
		throw error;
	}

	console.log(
		`[OIDC] Successfully seeded ${clients.length} client(s) to database`,
	);
}

/**
 * Reset the seeding state. Only for testing purposes.
 * @internal
 */
export function _resetSeedingState(): void {
	seedingPromise = null;
}
