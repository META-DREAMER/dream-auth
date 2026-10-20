import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetOpenIdConfig } = vi.hoisted(() => ({
	mockGetOpenIdConfig: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: { api: { getOpenIdConfig: mockGetOpenIdConfig } },
}));

import { GET } from "./openid-configuration";

// What the plugin reports with the jwt issuer set to the root
// (src/lib/oidc/issuer.ts): endpoints stay under the /api/auth base path.
const pluginMetadata = {
	issuer: "https://auth.example.com",
	authorization_endpoint: "https://auth.example.com/api/auth/oauth2/authorize",
	token_endpoint: "https://auth.example.com/api/auth/oauth2/token",
	userinfo_endpoint: "https://auth.example.com/api/auth/oauth2/userinfo",
	jwks_uri: "https://auth.example.com/api/auth/jwks",
	end_session_endpoint: "https://auth.example.com/api/auth/oauth2/end-session",
};

function mockMetadata(extra: Record<string, unknown> = {}) {
	mockGetOpenIdConfig.mockResolvedValue({
		...pluginMetadata,
		...extra,
	});
}

async function get() {
	const request = new Request(
		"https://auth.example.com/.well-known/openid-configuration",
	);
	return GET({ request, params: {} });
}

describe("GET /.well-known/openid-configuration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("publishes the plugin's issuer unchanged", async () => {
		mockMetadata({ issuer: "https://issuer.example.com" });

		const data = await (await get()).json();

		expect(data.issuer).toBe("https://issuer.example.com");
	});

	it("reads the server-only metadata endpoint with the request headers", async () => {
		mockMetadata();

		await get();

		expect(mockGetOpenIdConfig).toHaveBeenCalledWith({
			headers: expect.any(Headers),
		});
	});

	it("rewrites all standard endpoints to root level", async () => {
		mockMetadata();

		const data = await (await get()).json();

		expect(data.authorization_endpoint).toBe(
			"https://auth.example.com/oauth2/authorize",
		);
		expect(data.token_endpoint).toBe("https://auth.example.com/oauth2/token");
		expect(data.userinfo_endpoint).toBe(
			"https://auth.example.com/oauth2/userinfo",
		);
		expect(data.jwks_uri).toBe(
			"https://auth.example.com/.well-known/jwks.json",
		);
		expect(data.end_session_endpoint).toBe(
			"https://auth.example.com/oauth2/end-session",
		);
	});

	it("rewrites optional revocation and introspection endpoints if present", async () => {
		mockMetadata({
			revocation_endpoint: "https://auth.example.com/api/auth/oauth2/revoke",
			introspection_endpoint:
				"https://auth.example.com/api/auth/oauth2/introspect",
		});

		const data = await (await get()).json();

		expect(data.revocation_endpoint).toBe(
			"https://auth.example.com/oauth2/revoke",
		);
		expect(data.introspection_endpoint).toBe(
			"https://auth.example.com/oauth2/introspect",
		);
	});

	it("omits optional endpoints the plugin does not report", async () => {
		mockMetadata();

		const data = await (await get()).json();

		expect(data).not.toHaveProperty("revocation_endpoint");
		expect(data).not.toHaveProperty("introspection_endpoint");
	});

	it("returns 404 when the OIDC provider is unavailable", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		mockGetOpenIdConfig.mockRejectedValue(new Error("NOT_FOUND"));

		const response = await get();

		expect(response.status).toBe(404);
	});

	it("sets Cache-Control header with 1 hour max-age", async () => {
		mockMetadata();

		const response = await get();

		expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
	});

	it("preserves additional OIDC properties from BetterAuth", async () => {
		mockMetadata({
			scopes_supported: ["openid", "profile", "email"],
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code", "refresh_token"],
		});

		const data = await (await get()).json();

		expect(data.scopes_supported).toEqual(["openid", "profile", "email"]);
		expect(data.response_types_supported).toEqual(["code"]);
		expect(data.grant_types_supported).toEqual([
			"authorization_code",
			"refresh_token",
		]);
	});
});
