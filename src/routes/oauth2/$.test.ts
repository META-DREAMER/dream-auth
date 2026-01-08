import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
	auth: {
		handler: vi.fn(),
	},
}));

import { auth } from "@/lib/auth";
import { GET, POST } from "./$";

describe("OAuth2 proxy route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("GET handler", () => {
		it("proxies request to BetterAuth oauth2 endpoint", async () => {
			const mockResponse = new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request("https://auth.example.com/oauth2/authorize");

			await GET({ request, params: { _splat: "authorize" } });

			expect(auth.handler).toHaveBeenCalledWith(
				expect.objectContaining({
					method: "GET",
				}),
			);
			// Verify the internal URL was constructed correctly
			const calledRequest = vi.mocked(auth.handler).mock.calls[0][0] as Request;
			expect(calledRequest.url).toContain("/api/auth/oauth2/authorize");
		});

		it("preserves query parameters in proxy", async () => {
			const mockResponse = new Response("ok", { status: 200 });
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request(
				"https://auth.example.com/oauth2/authorize?client_id=test&redirect_uri=http://localhost",
			);

			await GET({ request, params: { _splat: "authorize" } });

			const calledRequest = vi.mocked(auth.handler).mock.calls[0][0] as Request;
			const url = new URL(calledRequest.url);
			expect(url.searchParams.get("client_id")).toBe("test");
			expect(url.searchParams.get("redirect_uri")).toBe("http://localhost");
		});

		it("converts BetterAuth JSON redirect to HTTP 302", async () => {
			const mockResponse = new Response(
				JSON.stringify({
					redirect: true,
					url: "https://app.example.com/callback?code=abc123",
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request("https://auth.example.com/oauth2/authorize");

			const response = await GET({
				request,
				params: { _splat: "authorize" },
			});

			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toBe(
				"https://app.example.com/callback?code=abc123",
			);
		});

		it("converts relative redirect URL to absolute", async () => {
			const mockResponse = new Response(
				JSON.stringify({
					redirect: true,
					url: "/consent?client_id=test",
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request("https://auth.example.com/oauth2/authorize");

			const response = await GET({
				request,
				params: { _splat: "authorize" },
			});

			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toBe(
				"https://auth.example.com/consent?client_id=test",
			);
		});

		it("passes through non-redirect JSON responses", async () => {
			const mockResponse = new Response(
				JSON.stringify({
					access_token: "token123",
					token_type: "Bearer",
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request("https://auth.example.com/oauth2/token");

			const response = await GET({
				request,
				params: { _splat: "token" },
			});

			// Should pass through the response as-is
			expect(response.status).toBe(200);
			expect(response.headers.get("Location")).toBeNull();
		});

		it("handles empty splat parameter", async () => {
			const mockResponse = new Response("ok", { status: 200 });
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request("https://auth.example.com/oauth2/");

			await GET({ request, params: { _splat: undefined } });

			const calledRequest = vi.mocked(auth.handler).mock.calls[0][0] as Request;
			expect(calledRequest.url).toContain("/api/auth/oauth2/");
		});
	});

	describe("POST handler", () => {
		it("proxies POST request to BetterAuth oauth2 endpoint", async () => {
			const mockResponse = new Response(
				JSON.stringify({ access_token: "token" }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request("https://auth.example.com/oauth2/token", {
				method: "POST",
				body: "grant_type=authorization_code&code=abc",
			});

			await POST({ request, params: { _splat: "token" } });

			expect(auth.handler).toHaveBeenCalledWith(
				expect.objectContaining({
					method: "POST",
				}),
			);
			const calledRequest = vi.mocked(auth.handler).mock.calls[0][0] as Request;
			expect(calledRequest.url).toContain("/api/auth/oauth2/token");
		});

		it("preserves POST body for form-encoded token exchange", async () => {
			const mockResponse = new Response(
				JSON.stringify({ access_token: "token123" }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const formBody =
				"grant_type=authorization_code&code=abc123&redirect_uri=http://localhost:3000/callback&client_id=test-app";
			const request = new Request("https://auth.example.com/oauth2/token", {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: formBody,
			});

			await POST({ request, params: { _splat: "token" } });

			const calledRequest = vi.mocked(auth.handler).mock.calls[0][0] as Request;
			// Body should be preserved - read it to verify
			const calledBody = await calledRequest.text();
			expect(calledBody).toBe(formBody);
		});

		it("preserves Content-Type header for POST requests", async () => {
			const mockResponse = new Response(
				JSON.stringify({ access_token: "token" }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request("https://auth.example.com/oauth2/token", {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: "grant_type=client_credentials",
			});

			await POST({ request, params: { _splat: "token" } });

			const calledRequest = vi.mocked(auth.handler).mock.calls[0][0] as Request;
			expect(calledRequest.headers.get("Content-Type")).toBe(
				"application/x-www-form-urlencoded",
			);
		});

		it("preserves Authorization header for client credentials", async () => {
			const mockResponse = new Response(
				JSON.stringify({ access_token: "token" }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const basicAuth = `Basic ${Buffer.from("client_id:client_secret").toString("base64")}`;
			const request = new Request("https://auth.example.com/oauth2/token", {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Authorization: basicAuth,
				},
				body: "grant_type=client_credentials",
			});

			await POST({ request, params: { _splat: "token" } });

			const calledRequest = vi.mocked(auth.handler).mock.calls[0][0] as Request;
			expect(calledRequest.headers.get("Authorization")).toBe(basicAuth);
		});

		it("converts POST JSON redirect to HTTP 302", async () => {
			const mockResponse = new Response(
				JSON.stringify({
					redirect: true,
					url: "https://app.example.com/callback",
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request("https://auth.example.com/oauth2/consent", {
				method: "POST",
			});

			const response = await POST({
				request,
				params: { _splat: "consent" },
			});

			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toBe(
				"https://app.example.com/callback",
			);
		});
	});

	describe("error handling", () => {
		it("passes through error responses from BetterAuth", async () => {
			const mockResponse = new Response(
				JSON.stringify({ error: "invalid_client" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				},
			);
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request("https://auth.example.com/oauth2/token", {
				method: "POST",
			});

			const response = await POST({
				request,
				params: { _splat: "token" },
			});

			expect(response.status).toBe(401);
		});

		it("handles non-JSON responses gracefully", async () => {
			const mockResponse = new Response("<html>Error page</html>", {
				status: 500,
				headers: { "Content-Type": "text/html" },
			});
			vi.mocked(auth.handler).mockResolvedValue(mockResponse);

			const request = new Request("https://auth.example.com/oauth2/authorize");

			const response = await GET({
				request,
				params: { _splat: "authorize" },
			});

			expect(response.status).toBe(500);
		});
	});
});
