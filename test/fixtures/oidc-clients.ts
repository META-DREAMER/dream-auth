import type { OidcClientConfig } from "@/lib/oidc/schemas";

/**
 * Test fixtures for OIDC client configurations
 */

export const validWebClient: OidcClientConfig = {
	clientId: "test-web-client",
	name: "Test Web Application",
	clientSecret: "super-secret-key-at-least-16-chars",
	type: "web",
	redirectURLs: ["https://app.example.com/callback"],
	skipConsent: false,
	disabled: false,
};

export const validPublicClient: OidcClientConfig = {
	clientId: "test-public-client",
	name: "Test Public Application",
	type: "public",
	redirectURLs: ["https://spa.example.com/callback"],
	skipConsent: true,
	disabled: false,
};

export const validNativeClient: OidcClientConfig = {
	clientId: "test-native-client",
	name: "Test Native Application",
	clientSecret: "native-app-secret-key",
	type: "native",
	redirectURLs: ["com.example.app://callback"],
	skipConsent: false,
	disabled: false,
};

export const validUserAgentClient: OidcClientConfig = {
	clientId: "test-user-agent-client",
	name: "Test User Agent Application",
	clientSecret: "user-agent-secret-key",
	type: "user-agent-based",
	redirectURLs: ["https://spa.example.com/callback"],
	skipConsent: false,
	disabled: false,
};

export const multipleClients: OidcClientConfig[] = [
	validWebClient,
	validPublicClient,
	{ ...validWebClient, clientId: "test-web-client-2", name: "Second Web App" },
];

/**
 * Invalid client configurations for negative testing
 */
export const invalidClients = {
	missingSecret: {
		clientId: "no-secret",
		name: "No Secret",
		type: "web" as const,
		redirectURLs: ["https://example.com/cb"],
	},
	emptyRedirects: {
		clientId: "no-redirects",
		name: "No Redirects",
		clientSecret: "secret",
		type: "web" as const,
		redirectURLs: [],
	},
	invalidUrl: {
		clientId: "bad-url",
		name: "Bad URL",
		clientSecret: "secret",
		type: "web" as const,
		redirectURLs: ["not-a-valid-url"],
	},
	emptyClientId: {
		clientId: "",
		name: "Empty Client ID",
		clientSecret: "secret",
		type: "web" as const,
		redirectURLs: ["https://example.com/cb"],
	},
	emptyName: {
		clientId: "empty-name",
		name: "",
		clientSecret: "secret",
		type: "web" as const,
		redirectURLs: ["https://example.com/cb"],
	},
};

/**
 * JSON strings for testing parseOidcClientsJson
 */
export const validClientJson = JSON.stringify([validWebClient]);

export const multipleClientsJson = JSON.stringify(multipleClients);

export const invalidJson = "not valid json";

export const nonArrayJson = JSON.stringify({ clientId: "not-array" });

export const mixedValidInvalidJson = JSON.stringify([
	validWebClient,
	invalidClients.missingSecret,
]);
