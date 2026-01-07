import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock TanStack router and auth before importing
vi.mock("@tanstack/react-router", () => ({
	createFileRoute: vi.fn((path: string) => {
		return (config: unknown) => {
			return { path, config };
		};
	}),
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		handler: vi.fn(),
	},
}));

import { auth } from "@/lib/auth";

describe("GET /.well-known/openid-configuration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	async function getHandler() {
		const { Route } = await import("./openid-configuration.ts");
		return (
			Route as {
				config: {
					server: {
						handlers: {
							GET: (ctx: { request: Request }) => Promise<Response>;
						};
					};
				};
			}
		).config.server.handlers.GET;
	}

	it("rewrites issuer to root URL", async () => {
		const mockDiscoveryData = {
			issuer: "https://auth.example.com/api/auth",
			authorization_endpoint:
				"https://auth.example.com/api/auth/oauth2/authorize",
			token_endpoint: "https://auth.example.com/api/auth/oauth2/token",
			userinfo_endpoint: "https://auth.example.com/api/auth/oauth2/userinfo",
			jwks_uri: "https://auth.example.com/api/auth/jwks",
			end_session_endpoint:
				"https://auth.example.com/api/auth/oauth2/endsession",
		};

		const mockResponse = new Response(JSON.stringify(mockDiscoveryData), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
		vi.mocked(auth.handler).mockResolvedValue(mockResponse);

		const handler = await getHandler();
		const request = new Request(
			"https://auth.example.com/.well-known/openid-configuration",
		);

		const response = await handler({ request });
		const data = await response.json();

		expect(data.issuer).toBe("https://auth.example.com");
	});

	it("rewrites all standard endpoints to root level", async () => {
		const mockDiscoveryData = {
			issuer: "https://auth.example.com/api/auth",
			authorization_endpoint:
				"https://auth.example.com/api/auth/oauth2/authorize",
			token_endpoint: "https://auth.example.com/api/auth/oauth2/token",
			userinfo_endpoint: "https://auth.example.com/api/auth/oauth2/userinfo",
			jwks_uri: "https://auth.example.com/api/auth/jwks",
			end_session_endpoint:
				"https://auth.example.com/api/auth/oauth2/endsession",
		};

		const mockResponse = new Response(JSON.stringify(mockDiscoveryData), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
		vi.mocked(auth.handler).mockResolvedValue(mockResponse);

		const handler = await getHandler();
		const request = new Request(
			"https://auth.example.com/.well-known/openid-configuration",
		);

		const response = await handler({ request });
		const data = await response.json();

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
			"https://auth.example.com/oauth2/endsession",
		);
	});

	it("rewrites optional revocation endpoint if present", async () => {
		const mockDiscoveryData = {
			issuer: "https://auth.example.com/api/auth",
			authorization_endpoint:
				"https://auth.example.com/api/auth/oauth2/authorize",
			token_endpoint: "https://auth.example.com/api/auth/oauth2/token",
			userinfo_endpoint: "https://auth.example.com/api/auth/oauth2/userinfo",
			jwks_uri: "https://auth.example.com/api/auth/jwks",
			end_session_endpoint:
				"https://auth.example.com/api/auth/oauth2/endsession",
			revocation_endpoint: "https://auth.example.com/api/auth/oauth2/revoke",
		};

		const mockResponse = new Response(JSON.stringify(mockDiscoveryData), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
		vi.mocked(auth.handler).mockResolvedValue(mockResponse);

		const handler = await getHandler();
		const request = new Request(
			"https://auth.example.com/.well-known/openid-configuration",
		);

		const response = await handler({ request });
		const data = await response.json();

		expect(data.revocation_endpoint).toBe(
			"https://auth.example.com/oauth2/revoke",
		);
	});

	it("rewrites optional introspection endpoint if present", async () => {
		const mockDiscoveryData = {
			issuer: "https://auth.example.com/api/auth",
			authorization_endpoint:
				"https://auth.example.com/api/auth/oauth2/authorize",
			token_endpoint: "https://auth.example.com/api/auth/oauth2/token",
			userinfo_endpoint: "https://auth.example.com/api/auth/oauth2/userinfo",
			jwks_uri: "https://auth.example.com/api/auth/jwks",
			end_session_endpoint:
				"https://auth.example.com/api/auth/oauth2/endsession",
			introspection_endpoint:
				"https://auth.example.com/api/auth/oauth2/introspect",
		};

		const mockResponse = new Response(JSON.stringify(mockDiscoveryData), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
		vi.mocked(auth.handler).mockResolvedValue(mockResponse);

		const handler = await getHandler();
		const request = new Request(
			"https://auth.example.com/.well-known/openid-configuration",
		);

		const response = await handler({ request });
		const data = await response.json();

		expect(data.introspection_endpoint).toBe(
			"https://auth.example.com/oauth2/introspect",
		);
	});

	it("sets Cache-Control header with 1 hour max-age", async () => {
		const mockDiscoveryData = {
			issuer: "https://auth.example.com/api/auth",
			authorization_endpoint:
				"https://auth.example.com/api/auth/oauth2/authorize",
			token_endpoint: "https://auth.example.com/api/auth/oauth2/token",
			userinfo_endpoint: "https://auth.example.com/api/auth/oauth2/userinfo",
			jwks_uri: "https://auth.example.com/api/auth/jwks",
			end_session_endpoint:
				"https://auth.example.com/api/auth/oauth2/endsession",
		};

		const mockResponse = new Response(JSON.stringify(mockDiscoveryData), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
		vi.mocked(auth.handler).mockResolvedValue(mockResponse);

		const handler = await getHandler();
		const request = new Request(
			"https://auth.example.com/.well-known/openid-configuration",
		);

		const response = await handler({ request });

		expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
	});

	it("proxies to correct BetterAuth endpoint", async () => {
		const mockResponse = new Response(JSON.stringify({}), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
		vi.mocked(auth.handler).mockResolvedValue(mockResponse);

		const handler = await getHandler();
		const request = new Request(
			"https://auth.example.com/.well-known/openid-configuration",
		);

		await handler({ request });

		const calledRequest = vi.mocked(auth.handler).mock.calls[0][0] as Request;
		expect(calledRequest.url).toContain(
			"/api/auth/.well-known/openid-configuration",
		);
	});

	it("passes through error responses", async () => {
		const mockResponse = new Response("Internal Server Error", {
			status: 500,
		});
		vi.mocked(auth.handler).mockResolvedValue(mockResponse);

		const handler = await getHandler();
		const request = new Request(
			"https://auth.example.com/.well-known/openid-configuration",
		);

		const response = await handler({ request });

		expect(response.status).toBe(500);
	});

	it("preserves additional OIDC properties from BetterAuth", async () => {
		const mockDiscoveryData = {
			issuer: "https://auth.example.com/api/auth",
			authorization_endpoint:
				"https://auth.example.com/api/auth/oauth2/authorize",
			token_endpoint: "https://auth.example.com/api/auth/oauth2/token",
			userinfo_endpoint: "https://auth.example.com/api/auth/oauth2/userinfo",
			jwks_uri: "https://auth.example.com/api/auth/jwks",
			end_session_endpoint:
				"https://auth.example.com/api/auth/oauth2/endsession",
			// Additional standard OIDC properties
			scopes_supported: ["openid", "profile", "email"],
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			subject_types_supported: ["public"],
			id_token_signing_alg_values_supported: ["RS256"],
		};

		const mockResponse = new Response(JSON.stringify(mockDiscoveryData), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
		vi.mocked(auth.handler).mockResolvedValue(mockResponse);

		const handler = await getHandler();
		const request = new Request(
			"https://auth.example.com/.well-known/openid-configuration",
		);

		const response = await handler({ request });
		const data = await response.json();

		// Check standard properties are preserved
		expect(data.scopes_supported).toEqual(["openid", "profile", "email"]);
		expect(data.response_types_supported).toEqual(["code"]);
		expect(data.grant_types_supported).toEqual([
			"authorization_code",
			"refresh_token",
		]);
	});
});
