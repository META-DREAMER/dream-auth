import { readFileSync, existsSync } from "node:fs";
import type { OidcClientConfig } from "./schemas";
import { oidcClientSchema } from "./schemas";

/**
 * Parse OIDC clients from a JSON string.
 * Returns an empty array on error (with logging).
 */
export function parseOidcClientsJson(
	val: string,
	source: string,
): OidcClientConfig[] {
	try {
		const parsed = JSON.parse(val);
		if (!Array.isArray(parsed)) {
			console.error(`[OIDC] ${source} must be a JSON array`);
			return [];
		}
		const validated = parsed.map((client, index) => {
			const result = oidcClientSchema.safeParse(client);
			if (!result.success) {
				console.error(
					`[OIDC] Invalid client config in ${source} at index ${index}:`,
					result.error.format(),
				);
				return null;
			}
			return result.data;
		});
		return validated.filter((c): c is OidcClientConfig => c !== null);
	} catch (e) {
		console.error(`[OIDC] Failed to parse ${source}:`, e);
		return [];
	}
}

/**
 * Load OIDC clients from a mounted file (JSON or YAML).
 * Supports both formats based on file content or extension.
 */
export function loadOidcClientsFromFile(
	filePath: string,
): OidcClientConfig[] {
	if (!existsSync(filePath)) {
		console.error(`[OIDC] OIDC_CLIENTS_FILE does not exist: ${filePath}`);
		// Fail fast in production
		if (process.env.NODE_ENV === "production") {
			throw new Error(`OIDC_CLIENTS_FILE not found: ${filePath}`);
		}
		return [];
	}

	try {
		const content = readFileSync(filePath, "utf-8");

		// Try to detect if it's YAML by checking for YAML-specific patterns
		// Simple heuristic: if it starts with "oidcClients:" or has no '{' at start, treat as YAML
		const trimmedContent = content.trim();
		const isLikelyYaml =
			trimmedContent.startsWith("oidcClients:") ||
			trimmedContent.startsWith("-") ||
			(!trimmedContent.startsWith("{") && !trimmedContent.startsWith("["));

		if (isLikelyYaml) {
			// For YAML support, we'd need a YAML parser
			// For now, provide clear error and suggest JSON format
			console.error(
				"[OIDC] YAML format detected but not yet supported. Please use JSON format:",
			);
			console.error(
				'[OIDC] Example: [{"clientId":"app","clientSecret":"secret","name":"App","type":"web","redirectURLs":["https://app.example.com/callback"]}]',
			);
			// Fail fast in production
			if (process.env.NODE_ENV === "production") {
				throw new Error("OIDC_CLIENTS_FILE: YAML format not supported, use JSON");
			}
			return [];
		}

		// Parse as JSON
		return parseOidcClientsJson(content, "OIDC_CLIENTS_FILE");
	} catch (e) {
		if (e instanceof Error && e.message.includes("OIDC_CLIENTS_FILE")) {
			throw e; // Re-throw our own errors
		}
		console.error(`[OIDC] Failed to read OIDC_CLIENTS_FILE:`, e);
		if (process.env.NODE_ENV === "production") {
			throw new Error(`Failed to read OIDC_CLIENTS_FILE: ${filePath}`);
		}
		return [];
	}
}

/**
 * Merge OIDC clients from environment and file, checking for duplicate client IDs.
 */
export function mergeOidcClients(
	envClients: OidcClientConfig[],
	fileClients: OidcClientConfig[],
): OidcClientConfig[] {
	const allClients = [...envClients, ...fileClients];
	const clientIds = new Set<string>();
	const duplicates: string[] = [];

	for (const client of allClients) {
		if (clientIds.has(client.clientId)) {
			duplicates.push(client.clientId);
		}
		clientIds.add(client.clientId);
	}

	if (duplicates.length > 0) {
		const message = `[OIDC] Duplicate client IDs found: ${duplicates.join(", ")}`;
		console.error(message);
		if (process.env.NODE_ENV === "production") {
			throw new Error(message);
		}
	}

	return allClients;
}








