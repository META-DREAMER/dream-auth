import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock TanStack router
vi.mock("@tanstack/react-router", () => ({
	createFileRoute: vi.fn((path: string) => {
		return (config: unknown) => {
			return { path, config };
		};
	}),
}));

// Mock auth module
vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}));

import { auth } from "@/lib/auth";

type RouteHandler = (ctx: { request: Request }) => Promise<Response>;
type RouteConfig = { config: { server: { handlers: { GET: RouteHandler } } } };

describe("GET /api/verify", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 401 when no session exists", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(null);

		const { Route } = await import("./verify");
		const handler = (Route as RouteConfig).config.server.handlers.GET;

		const request = new Request("http://localhost:3000/api/verify");
		const response = await handler({ request });

		expect(response.status).toBe(401);
	});

	it("returns 200 with user headers when session exists", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue({
			user: {
				id: "user-123",
				email: "test@example.com",
				name: "Test User",
			},
			session: {
				id: "session-123",
				userId: "user-123",
				expiresAt: new Date(),
			},
		} as never);

		const { Route } = await import("./verify");
		const handler = (Route as RouteConfig).config.server.handlers.GET;

		const request = new Request("http://localhost:3000/api/verify", {
			headers: {
				Cookie: "session=test-session-cookie",
			},
		});
		const response = await handler({ request });

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Auth-User")).toBe("Test User");
		expect(response.headers.get("X-Auth-Id")).toBe("user-123");
		expect(response.headers.get("X-Auth-Email")).toBe("test@example.com");
	});

	it("returns empty X-Auth-User when user has no name", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue({
			user: {
				id: "user-123",
				email: "test@example.com",
				name: null,
			},
			session: {
				id: "session-123",
				userId: "user-123",
				expiresAt: new Date(),
			},
		} as never);

		const { Route } = await import("./verify");
		const handler = (Route as RouteConfig).config.server.handlers.GET;

		const request = new Request("http://localhost:3000/api/verify");
		const response = await handler({ request });

		expect(response.headers.get("X-Auth-User")).toBe("");
	});

	it("passes request headers to getSession", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(null);

		const { Route } = await import("./verify");
		const handler = (Route as RouteConfig).config.server.handlers.GET;

		const request = new Request("http://localhost:3000/api/verify", {
			headers: {
				Cookie: "session=my-session",
				Authorization: "Bearer token",
			},
		});
		await handler({ request });

		expect(auth.api.getSession).toHaveBeenCalledWith({
			headers: request.headers,
		});
	});

	it("returns null body on success", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue({
			user: {
				id: "user-123",
				email: "test@example.com",
				name: "Test User",
			},
			session: {
				id: "session-123",
				userId: "user-123",
				expiresAt: new Date(),
			},
		} as never);

		const { Route } = await import("./verify");
		const handler = (Route as RouteConfig).config.server.handlers.GET;

		const request = new Request("http://localhost:3000/api/verify");
		const response = await handler({ request });

		const body = await response.text();
		expect(body).toBe("");
	});

	it("returns null body on failure", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(null);

		const { Route } = await import("./verify");
		const handler = (Route as RouteConfig).config.server.handlers.GET;

		const request = new Request("http://localhost:3000/api/verify");
		const response = await handler({ request });

		const body = await response.text();
		expect(body).toBe("");
	});
});
