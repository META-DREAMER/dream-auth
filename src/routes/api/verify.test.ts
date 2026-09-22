import { createMockSession } from "@test/mocks/auth-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth module
vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}));

import { auth } from "@/lib/auth";
import { GET } from "./verify";

describe("GET /api/verify", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 401 when no session exists", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(null);

		const request = new Request("http://localhost:3000/api/verify");
		const response = await GET({ request, params: {} });

		expect(response.status).toBe(401);
	});

	it("returns 200 with user headers when session exists", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(
			createMockSession({
				user: { id: "user-123", email: "test@example.com", name: "Test User" },
				session: { id: "session-123" },
			}),
		);

		const request = new Request("http://localhost:3000/api/verify", {
			headers: {
				Cookie: "session=test-session-cookie",
			},
		});
		const response = await GET({ request, params: {} });

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Auth-User")).toBe("Test User");
		expect(response.headers.get("X-Auth-Id")).toBe("user-123");
		expect(response.headers.get("X-Auth-Email")).toBe("test@example.com");
	});

	it("returns empty X-Auth-User when user has no name", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(
			createMockSession({
				user: { id: "user-123", email: "test@example.com", name: "" },
				session: { id: "session-123" },
			}),
		);

		const request = new Request("http://localhost:3000/api/verify");
		const response = await GET({ request, params: {} });

		expect(response.headers.get("X-Auth-User")).toBe("");
	});

	it("passes request headers to getSession", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(null);

		const request = new Request("http://localhost:3000/api/verify", {
			headers: {
				Cookie: "session=my-session",
				Authorization: "Bearer token",
			},
		});
		await GET({ request, params: {} });

		expect(auth.api.getSession).toHaveBeenCalledWith({
			headers: request.headers,
		});
	});

	it("returns null body on success", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(
			createMockSession({
				user: { id: "user-123", email: "test@example.com", name: "Test User" },
				session: { id: "session-123" },
			}),
		);

		const request = new Request("http://localhost:3000/api/verify");
		const response = await GET({ request, params: {} });

		const body = await response.text();
		expect(body).toBe("");
	});

	it("returns null body on failure", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(null);

		const request = new Request("http://localhost:3000/api/verify");
		const response = await GET({ request, params: {} });

		const body = await response.text();
		expect(body).toBe("");
	});
	it("emits no identity headers on 401", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(null);

		const response = await GET({
			request: new Request("http://localhost:3000/api/verify"),
			params: {},
		});

		expect(response.headers.get("X-Auth-Id")).toBeNull();
		expect(response.headers.get("X-Auth-User")).toBeNull();
		expect(response.headers.get("X-Auth-Email")).toBeNull();
	});

	it("never reflects client-supplied X-Auth-* headers", async () => {
		// ingress forwards the client's own headers to this subrequest
		// (proxy_pass_request_headers on), so echoing one would let a spoof
		// round-trip back onto the upstream request.
		vi.mocked(auth.api.getSession).mockResolvedValue(
			createMockSession({
				user: { id: "user-123", email: "test@example.com", name: "Test User" },
				session: { id: "session-123" },
			}),
		);

		const response = await GET({
			request: new Request("http://localhost:3000/api/verify", {
				headers: {
					"X-Auth-Id": "root",
					"X-Auth-User": "admin",
					"X-Auth-Email": "admin@example.com",
					"X-Auth-Admin": "true",
					"X-Forwarded-User": "admin",
				},
			}),
			params: {},
		});

		expect(response.headers.get("X-Auth-Id")).toBe("user-123");
		expect(response.headers.get("X-Auth-User")).toBe("Test User");
		expect(response.headers.get("X-Auth-Email")).toBe("test@example.com");
		expect(response.headers.get("X-Auth-Admin")).toBeNull();
		expect(response.headers.get("X-Forwarded-User")).toBeNull();
	});

	it("treats an expired or deleted-user session exactly like no session", async () => {
		// Better Auth re-reads the session row on every getSession call and
		// returns null for an expired row or one removed with its user.
		vi.mocked(auth.api.getSession).mockResolvedValue(null);

		const response = await GET({
			request: new Request("http://localhost:3000/api/verify", {
				headers: { Cookie: "better-auth.session_token=expired" },
			}),
			params: {},
		});

		expect(response.status).toBe(401);
		expect(response.headers.get("X-Auth-Id")).toBeNull();
	});

	it("fails closed with 503 when the session lookup throws", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		vi.mocked(auth.api.getSession).mockRejectedValue(
			new Error("connection terminated"),
		);

		const response = await GET({
			request: new Request("http://localhost:3000/api/verify"),
			params: {},
		});

		expect(response.status).toBe(503);
		expect(response.headers.get("X-Auth-Id")).toBeNull();
		consoleError.mockRestore();
	});

	it("keeps the auth decision out of caches", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(
			createMockSession({
				user: { id: "user-123", email: "test@example.com", name: "Test User" },
				session: { id: "session-123" },
			}),
		);

		const ok = await GET({
			request: new Request("http://localhost:3000/api/verify"),
			params: {},
		});
		expect(ok.headers.get("Cache-Control")).toBe("no-store");

		vi.mocked(auth.api.getSession).mockResolvedValue(null);
		const denied = await GET({
			request: new Request("http://localhost:3000/api/verify"),
			params: {},
		});
		expect(denied.headers.get("Cache-Control")).toBe("no-store");
	});

	it("sanitizes a display name that would split the response", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(
			createMockSession({
				user: {
					id: "user-123",
					email: "test@example.com",
					name: "evil\r\nX-Auth-Admin: true",
				},
				session: { id: "session-123" },
			}),
		);

		const response = await GET({
			request: new Request("http://localhost:3000/api/verify"),
			params: {},
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Auth-Admin")).toBeNull();
		expect(response.headers.get("X-Auth-User")).toBe("evilX-Auth-Admin: true");
	});

	it("does not 500 on a non-latin1 display name", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(
			createMockSession({
				user: {
					id: "user-123",
					email: "test@example.com",
					name: "\u5c71\u7530",
				},
				session: { id: "session-123" },
			}),
		);

		const response = await GET({
			request: new Request("http://localhost:3000/api/verify"),
			params: {},
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Auth-User")).toBe("");
		expect(response.headers.get("X-Auth-Id")).toBe("user-123");
	});
});
