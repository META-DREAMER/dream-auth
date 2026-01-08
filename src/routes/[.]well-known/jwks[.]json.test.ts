import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
	auth: {
		handler: vi.fn(),
	},
}));

import { auth } from "@/lib/auth";
import { GET, HEAD } from "./jwks[.]json";

describe("/.well-known/jwks.json", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("GET handler", () => {
		it("returns JWKS from BetterAuth", async () => {
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

			const mockResponse = new Response(JSON.stringify(mockJwks), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
			);

			const response = await GET({ request, params: {} });
			const data = await response.json();

			expect(data.keys).toBeDefined();
			expect(data.keys).toHaveLength(1);
			expect(data.keys[0].kty).toBe("RSA");
		});

		it("sets Cache-Control header with 1 hour max-age", async () => {
			const mockJwks = { keys: [] };
			const mockResponse = new Response(JSON.stringify(mockJwks), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
			);

			const response = await GET({ request, params: {} });

			expect(response.headers.get("Cache-Control")).toBe(
				"public, max-age=3600, must-revalidate",
			);
		});

		it("proxies to correct BetterAuth endpoint", async () => {
			const mockResponse = new Response(JSON.stringify({ keys: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
			);

			await GET({ request, params: {} });

			const calledRequest = vi.mocked(auth.handler).mock.calls[0][0] as Request;
			expect(calledRequest.url).toContain("/api/auth/jwks");
		});

		it("passes through error responses", async () => {
			const mockResponse = new Response("Not Found", { status: 404 });
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
			);

			const response = await GET({ request, params: {} });

			expect(response.status).toBe(404);
		});

		it("preserves BetterAuth headers while adding Cache-Control", async () => {
			const mockJwks = { keys: [] };
			const mockResponse = new Response(JSON.stringify(mockJwks), {
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"X-Custom-Header": "test-value",
				},
			});
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
			);

			const response = await GET({ request, params: {} });

			// Cache-Control should be set/overridden
			expect(response.headers.get("Cache-Control")).toBe(
				"public, max-age=3600, must-revalidate",
			);
		});
	});

	describe("HEAD handler", () => {
		it("returns 200 with Cache-Control header but no body", async () => {
			const mockJwks = { keys: [] };
			const mockResponse = new Response(JSON.stringify(mockJwks), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
				{ method: "HEAD" },
			);

			const response = await HEAD({ request, params: {} });

			expect(response.status).toBe(200);
			expect(response.headers.get("Cache-Control")).toBe(
				"public, max-age=3600, must-revalidate",
			);
			// HEAD should have no body
			expect(await response.text()).toBe("");
		});

		it("returns error status for failed GET", async () => {
			const mockResponse = new Response("Not Found", { status: 404 });
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
				{ method: "HEAD" },
			);

			const response = await HEAD({ request, params: {} });

			expect(response.status).toBe(404);
			expect(await response.text()).toBe("");
		});

		it("makes GET request internally to verify endpoint exists", async () => {
			const mockJwks = { keys: [] };
			const mockResponse = new Response(JSON.stringify(mockJwks), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
				{ method: "HEAD" },
			);

			await HEAD({ request, params: {} });

			// Should have made a GET request internally
			const calledRequest = vi.mocked(auth.handler).mock.calls[0][0] as Request;
			expect(calledRequest.method).toBe("GET");
		});
	});
});
