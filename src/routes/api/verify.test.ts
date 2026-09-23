import { createMockSession } from "@test/mocks/auth-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// Authorization inputs. Unset org id by default, which is the legacy
// authentication-only behaviour every pre-existing test below assumes; the
// authorization block pins it to an org and drives the membership lookup.
vi.mock("@/lib/org-access", () => ({
	getForwardAuthOrgId: vi.fn<() => string | undefined>(() => undefined),
	orgAccessLookup: { getOrgAccess: vi.fn() },
}));

import { auth } from "@/lib/auth";
import type { OrgAccess } from "@/lib/forward-auth-authz";
import { getForwardAuthOrgId, orgAccessLookup } from "@/lib/org-access";
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

describe("GET /api/verify authorization (FORWARD_AUTH_ORG_ID set)", () => {
	const HOME = "org_home_01";

	const owner: OrgAccess = {
		role: "owner",
		teams: [{ name: "media", isMember: false }],
	};
	const admin: OrgAccess = {
		role: "admin",
		teams: [{ name: "media", isMember: false }],
	};
	const memberInTeam: OrgAccess = {
		role: "member",
		teams: [{ name: "Media", isMember: true }],
	};
	const memberNotInTeam: OrgAccess = {
		role: "member",
		teams: [{ name: "media", isMember: false }],
	};

	const MODES = {
		none: VERIFY_REDIRECT,
		"role=admin": `${VERIFY_REDIRECT}&role=admin`,
		"team=media": `${VERIFY_REDIRECT}&team=media`,
	} as const;

	function signedIn(id = "user-123") {
		vi.mocked(auth.api.getSession).mockResolvedValue(
			createMockSession({
				user: { id, email: `${id}@example.com`, name: "Test User" },
				session: { id: "session-123" },
			}),
		);
	}

	function access(value: OrgAccess | null) {
		vi.mocked(orgAccessLookup.getOrgAccess).mockResolvedValue(value);
	}

	let consoleWarn: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getForwardAuthOrgId).mockReturnValue(HOME);
		consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleWarn.mockRestore();
	});

	// The full matrix: mode x principal -> allowed?
	const MATRIX: Array<[keyof typeof MODES, string, OrgAccess | null, boolean]> =
		[
			["none", "owner", owner, true],
			["none", "admin", admin, true],
			["none", "member in team", memberInTeam, true],
			["none", "member not in team", memberNotInTeam, true],
			["none", "non-member", null, false],
			["role=admin", "owner", owner, true],
			["role=admin", "admin", admin, true],
			["role=admin", "member in team", memberInTeam, false],
			["role=admin", "member not in team", memberNotInTeam, false],
			["role=admin", "non-member", null, false],
			["team=media", "owner", owner, true],
			["team=media", "admin", admin, true],
			["team=media", "member in team", memberInTeam, true],
			["team=media", "member not in team", memberNotInTeam, false],
			["team=media", "non-member", null, false],
		];

	it.each(
		MATRIX,
	)("mode %s: %s -> allowed=%s", async (mode, _who, orgAccess, allowed) => {
		signedIn();
		access(orgAccess);

		const response = await verify(MODES[mode], {
			...traefikHeaders(),
			Cookie: "better-auth.session_token=valid",
		});

		if (allowed) {
			expect(response.status).toBe(200);
			expect(response.headers.get("X-Auth-Id")).toBe("user-123");
		} else {
			// A navigation in redirect mode: bounce to our forbidden page.
			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toBe(
				"https://auth.example.com/forbidden?redirect=https%3A%2F%2Fapp.example.com%2Fdashboard%3Ftab%3D1",
			);
			expect(response.headers.get("X-Auth-Id")).toBeNull();
			expect(response.headers.get("X-Auth-Groups")).toBeNull();
		}
		expect(orgAccessLookup.getOrgAccess).toHaveBeenCalledWith("user-123", HOME);
	});

	it.each(
		Object.entries(MODES),
	)("mode %s: signed out is unchanged (302 to login)", async (_mode, url) => {
		vi.mocked(auth.api.getSession).mockResolvedValue(null);

		const response = await verify(url, traefikHeaders());

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe(
			"https://auth.example.com/login?redirect=https%3A%2F%2Fapp.example.com%2Fdashboard%3Ftab%3D1",
		);
		expect(orgAccessLookup.getOrgAccess).not.toHaveBeenCalled();
	});

	it("returns a bare 403 for a non-navigation when not authorized", async () => {
		signedIn();
		access(null);

		const response = await verify(VERIFY_REDIRECT, {
			...traefikHeaders({ method: "POST" }),
			Cookie: "better-auth.session_token=valid",
		});

		expect(response.status).toBe(403);
		expect(response.headers.get("Location")).toBeNull();
		expect(response.headers.get("X-Auth-Id")).toBeNull();
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(await response.text()).toBe("");
	});

	it("returns a bare 403 in nginx mode (no ?mode=redirect) when not authorized", async () => {
		signedIn();
		access(memberNotInTeam);

		const response = await verify(`${VERIFY}?team=media`, traefikHeaders());

		expect(response.status).toBe(403);
		expect(response.headers.get("Location")).toBeNull();
	});

	it("denies an unknown team and logs its name", async () => {
		signedIn();
		access(memberInTeam);

		const response = await verify(`${VERIFY}?team=photos`);

		expect(response.status).toBe(403);
		expect(consoleWarn).toHaveBeenCalledTimes(1);
		expect(String(consoleWarn.mock.calls[0][0])).toContain('"photos"');
		expect(String(consoleWarn.mock.calls[0][0])).toContain("does not exist");
	});

	it("denies a user who owns a different org, even one whose slug is home", async () => {
		// Authorization is keyed on the org *id*; the lookup is asked about
		// the pinned org only, and a different org - whatever its slug - is
		// simply not that one.
		signedIn("impostor");
		vi.mocked(orgAccessLookup.getOrgAccess).mockImplementation(
			async (_userId, orgId) =>
				orgId === "org_fake_home" ? { role: "owner", teams: [] } : null,
		);

		const response = await verify(`${VERIFY}?role=admin`);

		expect(response.status).toBe(403);
		expect(orgAccessLookup.getOrgAccess).toHaveBeenCalledWith("impostor", HOME);
	});

	it("reads the requirement from the verify URL only, never from X-Forwarded-Uri", async () => {
		signedIn();
		access(memberNotInTeam);

		// The client's own URL carries `?team=media`, `&role=admin`, and even
		// the verify URL's parameter names. The verify URL itself asks for
		// team=media, which this member is not in.
		const attempts = [
			"/dashboard?team=media",
			"/dashboard?role=admin",
			"/dashboard?x=1&team=media&role=admin",
			"/api/verify?mode=redirect&team=media",
		];
		for (const uri of attempts) {
			const response = await verify(`${VERIFY}?team=media`, {
				...traefikHeaders({ uri }),
				Cookie: "better-auth.session_token=valid",
			});
			expect(response.status).toBe(403);
		}

		// And the other way round: the verify URL asks for nothing, so a
		// client URL asking for a team cannot *narrow* the check either.
		access(memberNotInTeam);
		const plain = await verify(VERIFY, {
			...traefikHeaders({ uri: "/dashboard?team=nonexistent" }),
		});
		expect(plain.status).toBe(200);
	});

	it("emits X-Auth-Groups with the role and the user's teams", async () => {
		signedIn();
		access({
			role: "member",
			teams: [
				{ name: "media", isMember: true },
				{ name: "ops", isMember: false },
				{ name: "photos", isMember: true },
			],
		});

		const response = await verify(VERIFY);

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Auth-Groups")).toBe(
			"role:member,team:media,team:photos",
		);
	});

	it("sanitizes X-Auth-Groups like every other identity header", async () => {
		signedIn();
		access({
			role: "member",
			teams: [
				{ name: "evil\r\nX-Auth-Admin: true,team:admin", isMember: true },
			],
		});

		const response = await verify(VERIFY);

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Auth-Admin")).toBeNull();
		expect(response.headers.get("X-Auth-Groups")).toBe(
			"role:member,team:evilX-Auth-Admin: trueteam:admin",
		);
	});

	it("never reflects a client-supplied X-Auth-Groups", async () => {
		signedIn();
		access(owner);

		const response = await verify(VERIFY, {
			"X-Auth-Groups": "role:owner,team:everything",
		});

		expect(response.headers.get("X-Auth-Groups")).toBe("role:owner");
	});

	describe("forbidden redirect", () => {
		beforeEach(() => {
			signedIn();
			access(null);
		});

		it("carries the sanitized app URL so the page can name it and send the user back", async () => {
			const response = await verify(
				VERIFY_REDIRECT,
				traefikHeaders({ host: "media.example.com", uri: "/photos" }),
			);
			expect(response.headers.get("Location")).toBe(
				"https://auth.example.com/forbidden?redirect=https%3A%2F%2Fmedia.example.com%2Fphotos",
			);
		});

		it.each([
			"evil.com",
			"example.com.evil.com",
			"app.example.com, evil.com",
			"app.example.com@evil.com",
			"127.0.0.1",
		])("drops a hostile X-Forwarded-Host %j rather than reflecting it", async (host) => {
			const response = await verify(
				VERIFY_REDIRECT,
				traefikHeaders({ host, uri: "/steal" }),
			);

			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toBe(
				"https://auth.example.com/forbidden",
			);
		});

		it("drops a plain-http return-to to a sibling host", async () => {
			const response = await verify(
				VERIFY_REDIRECT,
				traefikHeaders({ proto: "http" }),
			);
			expect(response.headers.get("Location")).toBe(
				"https://auth.example.com/forbidden",
			);
		});

		it("never emits a Location that leaves the auth origin", async () => {
			const hostile = [
				traefikHeaders({ host: "evil.com" }),
				traefikHeaders({ uri: "//evil.com" }),
				traefikHeaders({ host: "example.com.evil.com" }),
				traefikHeaders({ proto: "javascript", host: "app.example.com" }),
			];
			for (const headers of hostile) {
				const response = await verify(VERIFY_REDIRECT, headers);
				const location = new URL(response.headers.get("Location") ?? "");
				expect(location.origin).toBe("https://auth.example.com");
				expect(location.pathname).toBe("/forbidden");
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
	});

	it("fails closed with 503 when the membership lookup throws", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		signedIn();
		vi.mocked(orgAccessLookup.getOrgAccess).mockRejectedValue(
			new Error("connection terminated"),
		);

		const response = await verify(VERIFY_REDIRECT, traefikHeaders());

		expect(response.status).toBe(503);
		expect(response.headers.get("Location")).toBeNull();
		expect(response.headers.get("X-Auth-Id")).toBeNull();
		consoleError.mockRestore();
	});

	describe("FORWARD_AUTH_ORG_ID unset (legacy)", () => {
		beforeEach(() => {
			vi.mocked(getForwardAuthOrgId).mockReturnValue(undefined);
			signedIn();
		});

		it("allows any signed-in user without consulting membership", async () => {
			const response = await verify(VERIFY_REDIRECT, traefikHeaders());

			expect(response.status).toBe(200);
			expect(response.headers.get("X-Auth-Id")).toBe("user-123");
			expect(response.headers.get("X-Auth-Groups")).toBe("");
			expect(orgAccessLookup.getOrgAccess).not.toHaveBeenCalled();
		});

		it("still denies a verify URL that asks for a team or role it cannot check", async () => {
			for (const url of [`${VERIFY}?team=media`, `${VERIFY}?role=admin`]) {
				const response = await verify(url);
				expect(response.status).toBe(403);
			}
			expect(orgAccessLookup.getOrgAccess).not.toHaveBeenCalled();
			expect(consoleWarn).toHaveBeenCalled();
		});
	});
});

describe("GET /api/verify with a multi-role member", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getForwardAuthOrgId).mockReturnValue("org_home_01");
		vi.mocked(auth.api.getSession).mockResolvedValue(
			createMockSession({
				user: { id: "user-123", email: "u@example.com", name: "U" },
				session: { id: "session-123" },
			}),
		);
		vi.mocked(orgAccessLookup.getOrgAccess).mockResolvedValue({
			role: "admin,member",
			teams: [{ name: "media", isMember: false }],
		});
	});

	it("passes role=admin and team= on the admin role", async () => {
		expect((await verify(`${VERIFY}?role=admin`)).status).toBe(200);
		expect((await verify(`${VERIFY}?team=media`)).status).toBe(200);
	});

	it("emits one role entry per role in X-Auth-Groups", async () => {
		const response = await verify(VERIFY);
		expect(response.headers.get("X-Auth-Groups")).toBe(
			"role:admin,role:member",
		);
	});
});
