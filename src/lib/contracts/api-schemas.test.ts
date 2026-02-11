import { createMockSession } from "@test/mocks/auth-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	healthResponseSchema,
	jwksResponseSchema,
	oidcDiscoveryResponseSchema,
	verifyHeadersSchema,
} from "./api-schemas";

// Mock auth for endpoints that need it
vi.mock("@/lib/auth", () => ({
	auth: {
		handler: vi.fn(),
		api: {
			getSession: vi.fn(),
		},
	},
}));

import { auth } from "@/lib/auth";
import { GET as jwksGET } from "@/routes/[.]well-known/jwks[.]json";
import { GET as oidcGET } from "@/routes/[.]well-known/openid-configuration";
import { GET as healthGET } from "@/routes/api/health";
import { GET as verifyGET } from "@/routes/api/verify";

describe("API contract verification", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("GET /api/health", () => {
		it("response matches healthResponseSchema", async () => {
			const response = await healthGET({
				request: new Request("http://localhost/api/health"),
				params: {},
			});
			const body = await response.json();

			const result = healthResponseSchema.safeParse(body);
			expect(result.success).toBe(true);
		});

		it("rejects response with wrong status value", () => {
			const result = healthResponseSchema.safeParse({
				status: "error",
				timestamp: new Date().toISOString(),
			});
			expect(result.success).toBe(false);
		});

		it("rejects response with invalid timestamp", () => {
			const result = healthResponseSchema.safeParse({
				status: "ok",
				timestamp: "not-a-date",
			});
			expect(result.success).toBe(false);
		});

		it("rejects response missing fields", () => {
			expect(healthResponseSchema.safeParse({ status: "ok" }).success).toBe(
				false,
			);
			expect(
				healthResponseSchema.safeParse({
					timestamp: new Date().toISOString(),
				}).success,
			).toBe(false);
		});
	});

	describe("GET /api/verify", () => {
		it("authenticated response headers match verifyHeadersSchema", async () => {
			vi.mocked(auth.api.getSession).mockResolvedValue(
				createMockSession({
					user: {
						id: "user-1",
						email: "alice@example.com",
						name: "Alice",
					},
					session: { id: "sess-1" },
				}),
			);

			const response = await verifyGET({
				request: new Request("http://localhost/api/verify"),
				params: {},
			});

			const headers = {
				"x-auth-user": response.headers.get("X-Auth-User") ?? "",
				"x-auth-id": response.headers.get("X-Auth-Id") ?? "",
				"x-auth-email": response.headers.get("X-Auth-Email") ?? "",
			};

			const result = verifyHeadersSchema.safeParse(headers);
			expect(result.success).toBe(true);
		});

		it("unauthenticated response returns 401 with no body", async () => {
			vi.mocked(auth.api.getSession).mockResolvedValue(null);

			const response = await verifyGET({
				request: new Request("http://localhost/api/verify"),
				params: {},
			});

			expect(response.status).toBe(401);
			expect(await response.text()).toBe("");
		});

		it("rejects missing required header fields", () => {
			const result = verifyHeadersSchema.safeParse({
				"x-auth-user": "Alice",
				// missing x-auth-id and x-auth-email
			});
			expect(result.success).toBe(false);
		});

		it("rejects invalid email in x-auth-email", () => {
			const result = verifyHeadersSchema.safeParse({
				"x-auth-user": "Alice",
				"x-auth-id": "user-1",
				"x-auth-email": "not-an-email",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("GET /.well-known/openid-configuration", () => {
		const mockDiscoveryData = {
			issuer: "https://auth.example.com/api/auth",
			authorization_endpoint:
				"https://auth.example.com/api/auth/oauth2/authorize",
			token_endpoint: "https://auth.example.com/api/auth/oauth2/token",
			userinfo_endpoint: "https://auth.example.com/api/auth/oauth2/userinfo",
			jwks_uri: "https://auth.example.com/api/auth/jwks",
			end_session_endpoint:
				"https://auth.example.com/api/auth/oauth2/endsession",
			scopes_supported: ["openid", "profile", "email"],
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			subject_types_supported: ["public"],
			id_token_signing_alg_values_supported: ["RS256"],
		};

		it("response matches oidcDiscoveryResponseSchema", async () => {
			vi.mocked(auth.handler).mockResolvedValue(
				new Response(JSON.stringify(mockDiscoveryData), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);

			const response = await oidcGET({
				request: new Request(
					"https://auth.example.com/.well-known/openid-configuration",
				),
				params: {},
			});
			const body = await response.json();

			const result = oidcDiscoveryResponseSchema.safeParse(body);
			expect(result.success).toBe(true);
		});

		it("response with optional endpoints matches schema", async () => {
			const dataWithOptional = {
				...mockDiscoveryData,
				revocation_endpoint: "https://auth.example.com/api/auth/oauth2/revoke",
				introspection_endpoint:
					"https://auth.example.com/api/auth/oauth2/introspect",
			};

			vi.mocked(auth.handler).mockResolvedValue(
				new Response(JSON.stringify(dataWithOptional), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);

			const response = await oidcGET({
				request: new Request(
					"https://auth.example.com/.well-known/openid-configuration",
				),
				params: {},
			});
			const body = await response.json();

			const result = oidcDiscoveryResponseSchema.safeParse(body);
			expect(result.success).toBe(true);
		});

		it("rejects response missing required endpoints", () => {
			const result = oidcDiscoveryResponseSchema.safeParse({
				issuer: "https://auth.example.com",
				// missing all required endpoint fields
			});
			expect(result.success).toBe(false);
		});

		it("rejects non-URL values for endpoint fields", () => {
			const result = oidcDiscoveryResponseSchema.safeParse({
				issuer: "not-a-url",
				authorization_endpoint: "not-a-url",
				token_endpoint: "not-a-url",
				userinfo_endpoint: "not-a-url",
				jwks_uri: "not-a-url",
				end_session_endpoint: "not-a-url",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("GET /.well-known/jwks.json", () => {
		it("response matches jwksResponseSchema", async () => {
			const mockJwks = {
				keys: [
					{
						kty: "RSA",
						use: "sig",
						kid: "key-1",
						n: "base64-modulus",
						e: "AQAB",
					},
				],
			};

			vi.mocked(auth.handler).mockResolvedValue(
				new Response(JSON.stringify(mockJwks), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);

			const response = await jwksGET({
				request: new Request("https://auth.example.com/.well-known/jwks.json"),
				params: {},
			});
			const body = await response.json();

			const result = jwksResponseSchema.safeParse(body);
			expect(result.success).toBe(true);
		});

		it("empty keys array matches schema", async () => {
			vi.mocked(auth.handler).mockResolvedValue(
				new Response(JSON.stringify({ keys: [] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);

			const response = await jwksGET({
				request: new Request("https://auth.example.com/.well-known/jwks.json"),
				params: {},
			});
			const body = await response.json();

			const result = jwksResponseSchema.safeParse(body);
			expect(result.success).toBe(true);
		});

		it("rejects response without keys array", () => {
			expect(jwksResponseSchema.safeParse({}).success).toBe(false);
			expect(jwksResponseSchema.safeParse({ keys: "not-array" }).success).toBe(
				false,
			);
		});

		it("rejects keys missing required kty field", () => {
			const result = jwksResponseSchema.safeParse({
				keys: [{ use: "sig", kid: "key-1" }],
			});
			expect(result.success).toBe(false);
		});
	});
});
