import { expect, test } from "@playwright/test";

/**
 * OIDC Discovery Endpoint E2E Tests
 *
 * Tests the OpenID Connect discovery endpoints:
 * - /.well-known/openid-configuration
 * - /.well-known/jwks.json
 */
test.describe("OIDC Discovery Endpoints", () => {
	test("GET /.well-known/openid-configuration returns valid config", async ({
		request,
		baseURL,
	}) => {
		const response = await request.get("/.well-known/openid-configuration");

		expect(response.status()).toBe(200);

		const config = await response.json();

		// Validate required OIDC fields
		expect(config.issuer).toBe(baseURL);
		expect(config.authorization_endpoint).toBe(`${baseURL}/oauth2/authorize`);
		expect(config.token_endpoint).toBe(`${baseURL}/oauth2/token`);
		expect(config.userinfo_endpoint).toBe(`${baseURL}/oauth2/userinfo`);
		expect(config.jwks_uri).toBe(`${baseURL}/.well-known/jwks.json`);

		// Validate supported scopes
		expect(config.scopes_supported).toContain("openid");
		expect(config.scopes_supported).toContain("profile");
		expect(config.scopes_supported).toContain("email");

		// Validate response types
		expect(config.response_types_supported).toContain("code");

		// Validate grant types
		expect(config.grant_types_supported).toContain("authorization_code");
	});

	test("GET /.well-known/jwks.json returns valid JWKS", async ({ request }) => {
		const response = await request.get("/.well-known/jwks.json");

		expect(response.status()).toBe(200);

		const jwks = await response.json();

		// Should have keys array
		expect(jwks.keys).toBeDefined();
		expect(Array.isArray(jwks.keys)).toBe(true);

		// If keys are present, they should have required fields
		// Note: In a fresh environment, keys may not be generated until first use
		for (const key of jwks.keys) {
			expect(key.kty).toBeDefined(); // Key type
			expect(key.kid).toBeDefined(); // Key ID
		}
	});

	test("JWKS has cache headers", async ({ request }) => {
		const response = await request.get("/.well-known/jwks.json");

		expect(response.status()).toBe(200);

		const headers = response.headers();
		expect(headers["cache-control"]).toBeDefined();
		expect(headers["cache-control"]).toContain("max-age");
	});

	test("discovery config has correct issuer", async ({ request, baseURL }) => {
		const response = await request.get("/.well-known/openid-configuration");
		const config = await response.json();

		// Issuer must exactly match the base URL
		expect(config.issuer).toBe(baseURL);

		// All endpoints should be under the issuer
		expect(config.authorization_endpoint).toContain(config.issuer);
		expect(config.token_endpoint).toContain(config.issuer);
		expect(config.userinfo_endpoint).toContain(config.issuer);
		expect(config.jwks_uri).toContain(config.issuer);
	});

	test("supports PKCE", async ({ request }) => {
		const response = await request.get("/.well-known/openid-configuration");
		const config = await response.json();

		// Should support S256 code challenge method (PKCE)
		expect(config.code_challenge_methods_supported).toContain("S256");
	});
});
