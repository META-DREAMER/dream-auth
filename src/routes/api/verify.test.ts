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

// Production shape for the redirect policy: auth on a subdomain, session cookie
// on the parent. `serverEnv` in the unit-test setup has no COOKIE_DOMAIN, and
// the interesting cases here are cross-subdomain.
vi.mock("@/lib/redirect/policy.env", () => ({
	getRedirectPolicy: () => ({
		origin: "https://auth.example.com",
		cookieDomain: ".example.com",
	}),
}));

import { auth } from "@/lib/auth";
import { GET } from "./verify";

/** Exactly the headers Traefik's forwardAuth puts on the auth subrequest. */
function traefikHeaders(
	overrides: Partial<Record<"method" | "proto" | "host" | "uri", string>> = {},
): Record<string, string> {
	return {
		"X-Forwarded-Method": overrides.method ?? "GET",
		"X-Forwarded-Proto": overrides.proto ?? "https",
		"X-Forwarded-Host": overrides.host ?? "app.example.com",
		"X-Forwarded-Uri": overrides.uri ?? "/dashboard?tab=1",
		"X-Forwarded-For": "203.0.113.7",
	};
}

const VERIFY = "http://dream-auth.auth.svc.cluster.local:3000/api/verify";
const VERIFY_REDIRECT = `${VERIFY}?mode=redirect`;

function verify(url: string, headers: Record<string, string> = {}) {
	return GET({ request: new Request(url, { headers }), params: {} });
}

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

	describe("?mode=redirect (Traefik forwardAuth)", () => {
		beforeEach(() => {
			vi.mocked(auth.api.getSession).mockResolvedValue(null);
		});

		it("302s to the login page with the original URL as the return-to", async () => {
			const response = await verify(VERIFY_REDIRECT, traefikHeaders());

			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toBe(
				"https://auth.example.com/login?redirect=https%3A%2F%2Fapp.example.com%2Fdashboard%3Ftab%3D1",
			);
			expect(response.headers.get("Cache-Control")).toBe("no-store");
			expect(response.headers.get("X-Auth-Id")).toBeNull();
			expect(await response.text()).toBe("");
		});

		it("treats HEAD as a navigation too", async () => {
			const response = await verify(
				VERIFY_REDIRECT,
				traefikHeaders({ method: "HEAD" }),
			);
			expect(response.status).toBe(302);
		});

		it("accepts a sibling host on a non-default port", async () => {
			const response = await verify(
				VERIFY_REDIRECT,
				traefikHeaders({ host: "app.example.com:8443", uri: "/x" }),
			);
			expect(response.headers.get("Location")).toBe(
				"https://auth.example.com/login?redirect=https%3A%2F%2Fapp.example.com%3A8443%2Fx",
			);
		});

		it("collapses the auth host itself to a same-origin path", async () => {
			const response = await verify(
				VERIFY_REDIRECT,
				traefikHeaders({ host: "auth.example.com", uri: "/org/members" }),
			);
			expect(response.headers.get("Location")).toBe(
				"https://auth.example.com/login?redirect=%2Forg%2Fmembers",
			);
		});

		it.each([
			"evil.com",
			"example.com.evil.com",
			"evilexample.com",
			"app.example.com.evil.com",
			"app.example.com, evil.com",
			"app.example.com@evil.com",
			"127.0.0.1",
		])("drops the return-to entirely for a hostile X-Forwarded-Host %j", async (host) => {
			const response = await verify(
				VERIFY_REDIRECT,
				traefikHeaders({ host, uri: "/steal" }),
			);

			expect(response.status).toBe(302);
			// Still a redirect - the user gets to sign in - but with no target,
			// so they land on our own homepage rather than the attacker's.
			expect(response.headers.get("Location")).toBe(
				"https://auth.example.com/login",
			);
		});

		it.each([
			"//evil.com",
			"//evil.com/x",
			"https:evil",
			"https://evil.com/",
			"/\\evil.com",
		])("keeps the host and drops a X-Forwarded-Uri that is not a path: %j", async (uri) => {
			const response = await verify(VERIFY_REDIRECT, traefikHeaders({ uri }));

			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toBe(
				"https://auth.example.com/login?redirect=https%3A%2F%2Fapp.example.com%2F",
			);
		});

		it("never emits a Location that leaves the allowed domains", async () => {
			const hostile = [
				traefikHeaders({ host: "evil.com" }),
				traefikHeaders({ uri: "//evil.com" }),
				traefikHeaders({ uri: "https://evil.com" }),
				traefikHeaders({ host: "example.com.evil.com" }),
				traefikHeaders({ proto: "javascript", host: "app.example.com" }),
			];
			for (const headers of hostile) {
				const response = await verify(VERIFY_REDIRECT, headers);
				const location = new URL(response.headers.get("Location") ?? "");
				expect(location.origin).toBe("https://auth.example.com");
				const target = location.searchParams.get("redirect");
				if (target) {
					const resolved = new URL(target, location.origin);
					expect(
						resolved.hostname === "example.com" ||
							resolved.hostname.endsWith(".example.com"),
					).toBe(true);
				}
			}
		});

		it("drops a plain-http return-to to a sibling host", async () => {
			// Cross-origin bounce-backs must be TLS; the policy rejects it.
			const response = await verify(
				VERIFY_REDIRECT,
				traefikHeaders({ proto: "http" }),
			);
			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toBe(
				"https://auth.example.com/login",
			);
		});

		it.each([
			"POST",
			"PUT",
			"PATCH",
			"DELETE",
			"OPTIONS",
		])("stays a 401 for a %s: there is no page to come back to", async (method) => {
			const response = await verify(
				VERIFY_REDIRECT,
				traefikHeaders({ method }),
			);
			expect(response.status).toBe(401);
			expect(response.headers.get("Location")).toBeNull();
			expect(response.headers.get("X-Auth-Id")).toBeNull();
		});

		it("stays a 401 when X-Forwarded-Method is missing", async () => {
			const { "X-Forwarded-Method": _omit, ...headers } = traefikHeaders();
			const response = await verify(VERIFY_REDIRECT, headers);
			expect(response.status).toBe(401);
		});

		it("still 302s when the X-Forwarded-* return-to headers are missing", async () => {
			// A misconfigured proxy that sends the method but nothing else gets a
			// usable login page rather than a dead 401.
			const response = await verify(VERIFY_REDIRECT, {
				"X-Forwarded-Method": "GET",
			});
			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toBe(
				"https://auth.example.com/login",
			);
		});

		it("ignores any other mode value", async () => {
			const response = await verify(`${VERIFY}?mode=deny`, traefikHeaders());
			expect(response.status).toBe(401);
		});

		it("returns 200 plus identity headers for an authenticated navigation", async () => {
			vi.mocked(auth.api.getSession).mockResolvedValue(
				createMockSession({
					user: {
						id: "user-123",
						email: "test@example.com",
						name: "Test User",
					},
					session: { id: "session-123" },
				}),
			);

			const response = await verify(VERIFY_REDIRECT, {
				...traefikHeaders(),
				Cookie: "better-auth.session_token=valid",
			});

			expect(response.status).toBe(200);
			expect(response.headers.get("Location")).toBeNull();
			expect(response.headers.get("X-Auth-Id")).toBe("user-123");
			expect(response.headers.get("X-Auth-User")).toBe("Test User");
			expect(response.headers.get("X-Auth-Email")).toBe("test@example.com");
		});

		it("fails closed with 503 rather than redirecting when the lookup throws", async () => {
			const consoleError = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			vi.mocked(auth.api.getSession).mockRejectedValue(new Error("down"));

			const response = await verify(VERIFY_REDIRECT, traefikHeaders());

			expect(response.status).toBe(503);
			expect(response.headers.get("Location")).toBeNull();
			consoleError.mockRestore();
		});
	});

	describe("nginx mode (no mode param) is unchanged", () => {
		it("returns a bare 401 even when Traefik-style headers are present", async () => {
			vi.mocked(auth.api.getSession).mockResolvedValue(null);

			const response = await verify(VERIFY, traefikHeaders());

			expect(response.status).toBe(401);
			expect(response.headers.get("Location")).toBeNull();
			expect(response.headers.get("X-Auth-Id")).toBeNull();
			expect(response.headers.get("Cache-Control")).toBe("no-store");
		});

		it("returns a bare 401 with the nginx X-Original-* headers", async () => {
			vi.mocked(auth.api.getSession).mockResolvedValue(null);

			const response = await verify(VERIFY, {
				"X-Original-URL": "https://app.example.com/dashboard",
				"X-Original-Method": "GET",
			});

			expect(response.status).toBe(401);
			expect(response.headers.get("Location")).toBeNull();
		});
	});
});
