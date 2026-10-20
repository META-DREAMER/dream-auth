import { describe, expect, it, vi } from "vitest";
import { buildJwtPluginOptions, getOidcIssuer } from "./issuer";

/**
 * A real better-auth instance with the jwt + oauthProvider pair configured the
 * way src/lib/auth.ts configures them (memory adapter, no database). The
 * discovery route is exercised against it, so the issuer it publishes is the
 * one the plugin actually uses, not a mocked one.
 */
const BETTER_AUTH_URL = "https://auth.example.com";

vi.mock("@/lib/auth", async () => {
	const { betterAuth } = await import("better-auth");
	const { jwt } = await import("better-auth/plugins");
	const { oauthProvider } = await import("@better-auth/oauth-provider");
	const { buildJwtPluginOptions } = await import("./issuer");
	return {
		auth: betterAuth({
			baseURL: "https://auth.example.com",
			secret: "test-secret-at-least-32-characters-long-for-testing",
			plugins: [
				jwt(buildJwtPluginOptions("https://auth.example.com")),
				oauthProvider({
					loginPage: "/login",
					consentPage: "/consent",
					scopes: ["openid", "profile", "email", "groups", "offline_access"],
				}),
			],
		}),
	};
});

const { auth } = await import("@/lib/auth");
const { GET } = await import("@/routes/[.]well-known/openid-configuration");

async function discovery() {
	const request = new Request(
		`${BETTER_AUTH_URL}/.well-known/openid-configuration`,
	);
	const response = await GET({ request, params: {} });
	expect(response.status).toBe(200);
	return response.json();
}

describe("getOidcIssuer", () => {
	it("is the origin of BETTER_AUTH_URL", () => {
		expect(getOidcIssuer("https://auth.md.wtf")).toBe("https://auth.md.wtf");
		expect(getOidcIssuer("https://auth.md.wtf/")).toBe("https://auth.md.wtf");
		expect(getOidcIssuer("http://localhost:3000")).toBe(
			"http://localhost:3000",
		);
	});

	it("is what the jwt plugin is configured with", () => {
		expect(buildJwtPluginOptions("https://auth.md.wtf/").jwt?.issuer).toBe(
			"https://auth.md.wtf",
		);
	});
});

describe("OIDC issuer consistency", () => {
	it("discovery publishes the issuer the jwt plugin is configured with", async () => {
		const data = await discovery();
		expect(data.issuer).toBe(getOidcIssuer(BETTER_AUTH_URL));
		expect(data.issuer).toBe(
			buildJwtPluginOptions(BETTER_AUTH_URL).jwt?.issuer,
		);
		expect(data.authorization_response_iss_parameter_supported).toBe(true);
	});

	it("tokens signed by the jwt plugin carry the discovery issuer", async () => {
		const { issuer } = await discovery();
		const { token } = await auth.api.signJWT({
			body: { payload: { sub: "user-1" } },
		});
		const [, payload] = token.split(".");
		const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
		expect(claims.iss).toBe(issuer);
	});

	it("serves root-level endpoints under the issuer", async () => {
		const data = await discovery();
		expect(data.authorization_endpoint).toBe(
			`${BETTER_AUTH_URL}/oauth2/authorize`,
		);
		expect(data.token_endpoint).toBe(`${BETTER_AUTH_URL}/oauth2/token`);
		expect(data.jwks_uri).toBe(`${BETTER_AUTH_URL}/.well-known/jwks.json`);
	});
});
