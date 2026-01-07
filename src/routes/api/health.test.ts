import { describe, expect, it } from "vitest";
import { GET } from "./health";

describe("GET /api/health", () => {
	it("returns 200 with status ok", async () => {
		const response = await GET({ request: new Request("http://localhost/api/health"), params: {} });
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.status).toBe("ok");
	});

	it("includes timestamp in response", async () => {
		const response = await GET({ request: new Request("http://localhost/api/health"), params: {} });
		const body = await response.json();

		expect(body.timestamp).toBeDefined();
		// Timestamp should be a valid ISO string
		expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
	});

	it("returns timestamp close to current time", async () => {
		const before = Date.now();
		const response = await GET({ request: new Request("http://localhost/api/health"), params: {} });
		const after = Date.now();
		const body = await response.json();

		const timestamp = new Date(body.timestamp).getTime();
		expect(timestamp).toBeGreaterThanOrEqual(before);
		expect(timestamp).toBeLessThanOrEqual(after);
	});
});
