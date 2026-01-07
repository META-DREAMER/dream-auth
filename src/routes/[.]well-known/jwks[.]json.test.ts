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

describe("/.well-known/jwks.json", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	async function getHandlers() {
		const { Route } = await import("./jwks[.]json.ts");
		return (
			Route as {
				config: {
					server: {
						handlers: {
							GET: (ctx: { request: Request }) => Promise<Response>;
							HEAD: (ctx: { request: Request }) => Promise<Response>;
						};
					};
				};
			}
		).config.server.handlers;
	}

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

			const handlers = await getHandlers();
			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
			);

			const response = await handlers.GET({ request });
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

			const handlers = await getHandlers();
			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
			);

			const response = await handlers.GET({ request });

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

			const handlers = await getHandlers();
			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
			);

			await handlers.GET({ request });

			const calledRequest = vi.mocked(auth.handler).mock.calls[0][0] as Request;
			expect(calledRequest.url).toContain("/api/auth/jwks");
		});

		it("passes through error responses", async () => {
			const mockResponse = new Response("Not Found", { status: 404 });
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const handlers = await getHandlers();
			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
			);

			const response = await handlers.GET({ request });

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

			const handlers = await getHandlers();
			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
			);

			const response = await handlers.GET({ request });

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

			const handlers = await getHandlers();
			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
				{ method: "HEAD" },
			);

			const response = await handlers.HEAD({ request });

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

			const handlers = await getHandlers();
			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
				{ method: "HEAD" },
			);

			const response = await handlers.HEAD({ request });

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

			const handlers = await getHandlers();
			const request = new Request(
				"https://auth.example.com/.well-known/jwks.json",
				{ method: "HEAD" },
			);

			await handlers.HEAD({ request });

			// Should have made a GET request internally
			const calledRequest = vi.mocked(auth.handler).mock.calls[0][0] as Request;
			expect(calledRequest.method).toBe("GET");
		});
	});
});
