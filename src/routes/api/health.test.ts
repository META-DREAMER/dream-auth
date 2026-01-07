import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock TanStack router before importing
vi.mock("@tanstack/react-router", () => ({
	createFileRoute: vi.fn((path: string) => {
		return (config: unknown) => {
			// Store the config so we can access handlers in tests
			return { path, config };
		};
	}),
}));

describe("GET /api/health", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 200 with status ok", async () => {
		// Import route after mocking
		const { Route } = await import("./health");

		// Access the handler from the route config
		const handler = (
			Route as {
				config: { server: { handlers: { GET: () => Promise<Response> } } };
			}
		).config.server.handlers.GET;

		const response = await handler();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.status).toBe("ok");
	});

	it("includes timestamp in response", async () => {
		const { Route } = await import("./health");

		const handler = (
			Route as {
				config: { server: { handlers: { GET: () => Promise<Response> } } };
			}
		).config.server.handlers.GET;

		const response = await handler();
		const body = await response.json();

		expect(body.timestamp).toBeDefined();
		// Timestamp should be a valid ISO string
		expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
	});

	it("returns timestamp close to current time", async () => {
		const { Route } = await import("./health");

		const handler = (
			Route as {
				config: { server: { handlers: { GET: () => Promise<Response> } } };
			}
		).config.server.handlers.GET;

		const before = Date.now();
		const response = await handler();
		const after = Date.now();
		const body = await response.json();

		const timestamp = new Date(body.timestamp).getTime();
		expect(timestamp).toBeGreaterThanOrEqual(before);
		expect(timestamp).toBeLessThanOrEqual(after);
	});
});
