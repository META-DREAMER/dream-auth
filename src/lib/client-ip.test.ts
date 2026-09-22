import { describe, expect, it, vi } from "vitest";
import {
	buildClientIpAdvancedOptions,
	clientIpConfigWarnings,
	DEFAULT_TRUSTED_CLIENT_IP_HEADERS,
	logClientIpConfigWarnings,
	parseTrustedClientIpHeaders,
} from "@/lib/client-ip";

/**
 * The behavioural half of this file drives a real better-auth instance
 * through `auth.handler` and watches for 429s. better-auth decides two things
 * at module load from NODE_ENV: whether `getIP()` may fall back to
 * `127.0.0.1` (test/dev only) and whether rate limiting is on. The header
 * question only matters in production, so the module is imported after
 * switching NODE_ENV, on its own module graph (vitest isolates test files).
 */
process.env.NODE_ENV = "production";
const { betterAuth } = await import("better-auth");
const { memoryAdapter } = await import("better-auth/adapters/memory");

const BASE_URL = "http://localhost:3000";
const MAX = 2;

/**
 * A minimal instance: memory adapter, memory rate-limit store, a tiny
 * per-path budget so a bucket is exhausted in three requests. The store is
 * module-global inside better-auth and keyed `ip|path`, so every test below
 * uses addresses of its own, and the tests that exercise the shared
 * `no-trusted-ip` bucket are kept together.
 */
function authWith(headers: string[]) {
	return betterAuth({
		baseURL: BASE_URL,
		secret: "test-secret-at-least-32-characters-long-for-testing",
		database: memoryAdapter({}),
		rateLimit: { enabled: true, storage: "memory", window: 60, max: MAX },
		advanced: buildClientIpAdvancedOptions(headers),
	});
}

async function ok(
	auth: ReturnType<typeof authWith>,
	headers: Record<string, string>,
) {
	const response = await auth.handler(
		new Request(`${BASE_URL}/api/auth/ok`, { headers }),
	);
	return response.status;
}

/** Statuses for `count` requests with the same headers. */
async function burst(
	auth: ReturnType<typeof authWith>,
	headers: Record<string, string>,
	count: number,
) {
	const statuses: number[] = [];
	for (let i = 0; i < count; i++) statuses.push(await ok(auth, headers));
	return statuses;
}

const CF_THEN_XFF = ["cf-connecting-ip", "x-forwarded-for"];

describe("parseTrustedClientIpHeaders", () => {
	it("falls back to better-auth's own default when unset or blank", () => {
		expect(parseTrustedClientIpHeaders(undefined)).toEqual([
			...DEFAULT_TRUSTED_CLIENT_IP_HEADERS,
		]);
		expect(parseTrustedClientIpHeaders("")).toEqual(["x-forwarded-for"]);
		expect(parseTrustedClientIpHeaders(" , ,")).toEqual(["x-forwarded-for"]);
	});

	it("keeps order, lower-cases, trims and de-duplicates", () => {
		expect(
			parseTrustedClientIpHeaders(
				" CF-Connecting-IP , x-forwarded-for,cf-connecting-ip ",
			),
		).toEqual(CF_THEN_XFF);
	});

	it("returns a fresh array so callers cannot mutate the default", () => {
		const parsed = parseTrustedClientIpHeaders(undefined);
		parsed.push("x-real-ip");
		expect(DEFAULT_TRUSTED_CLIENT_IP_HEADERS).toEqual(["x-forwarded-for"]);
	});
});

describe("buildClientIpAdvancedOptions", () => {
	it("produces the advanced.ipAddress fragment better-auth reads", () => {
		expect(buildClientIpAdvancedOptions(CF_THEN_XFF)).toEqual({
			ipAddress: { ipAddressHeaders: CF_THEN_XFF },
		});
	});
});

describe("clientIpConfigWarnings", () => {
	const prod = { configured: true, production: true };

	it("is silent for the documented production configuration", () => {
		expect(clientIpConfigWarnings(CF_THEN_XFF, prod)).toEqual([]);
	});

	it("warns when production runs on the unset default", () => {
		const warnings = clientIpConfigWarnings(["x-forwarded-for"], {
			configured: false,
			production: true,
		});
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("TRUSTED_CLIENT_IP_HEADERS is not set");
	});

	it("stays quiet on the unset default outside production", () => {
		expect(
			clientIpConfigWarnings(["x-forwarded-for"], {
				configured: false,
				production: false,
			}),
		).toEqual([]);
	});

	it("warns when x-forwarded-for is missing, so LAN traffic shares a bucket", () => {
		const warnings = clientIpConfigWarnings(["cf-connecting-ip"], prod);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("share one rate-limit bucket");
	});

	it("warns when x-forwarded-for shadows the Cloudflare header", () => {
		const warnings = clientIpConfigWarnings(
			["x-forwarded-for", "cf-connecting-ip"],
			prod,
		);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("never consulted");
	});

	it("warns about true-client-ip", () => {
		const warnings = clientIpConfigWarnings(
			["true-client-ip", "x-forwarded-for"],
			prod,
		);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("Enterprise");
	});

	it("warns about a header it does not document", () => {
		const warnings = clientIpConfigWarnings(
			["x-envoy-external-address", "x-forwarded-for"],
			prod,
		);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("x-envoy-external-address");
	});
});

describe("logClientIpConfigWarnings", () => {
	it("logs once per process, however many module copies call it", () => {
		const warn = vi.fn();
		const unset = { configured: false, production: true };

		logClientIpConfigWarnings(["x-forwarded-for"], unset, warn);
		logClientIpConfigWarnings(["x-forwarded-for"], unset, warn);

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0]?.[0]).toMatch(/^\[client-ip\] /);
	});
});

describe("rate limiting keyed on the configured header", () => {
	it("gives two CF-Connecting-IP values separate buckets", async () => {
		const auth = authWith(CF_THEN_XFF);
		const a = { "cf-connecting-ip": "198.51.100.1" };
		const b = { "cf-connecting-ip": "198.51.100.2" };

		expect(await burst(auth, a, MAX + 1)).toEqual([200, 200, 429]);
		// A is exhausted; B has not spent anything.
		expect(await burst(auth, b, MAX)).toEqual([200, 200]);
		expect(await ok(auth, a)).toBe(429);
	});

	it("ignores a forged X-Forwarded-For when the configured header is present", async () => {
		const auth = authWith(CF_THEN_XFF);
		const cf = "198.51.100.3";

		// Three requests from one Cloudflare-seen client, each claiming a
		// different address in X-Forwarded-For. If the forgery worked, each
		// would land in a fresh bucket and none would be limited.
		expect(
			await ok(auth, {
				"cf-connecting-ip": cf,
				"x-forwarded-for": "203.0.113.1",
			}),
		).toBe(200);
		expect(
			await ok(auth, {
				"cf-connecting-ip": cf,
				"x-forwarded-for": "203.0.113.2",
			}),
		).toBe(200);
		expect(
			await ok(auth, {
				"cf-connecting-ip": cf,
				"x-forwarded-for": "203.0.113.3, 203.0.113.4",
			}),
		).toBe(429);

		// And the forged addresses were not charged.
		expect(await ok(auth, { "x-forwarded-for": "203.0.113.1" })).toBe(200);
	});

	it("falls back to the ingress-set X-Forwarded-For when Cloudflare's header is absent", async () => {
		// The LAN path: the ingress overwrites X-Forwarded-For with the peer
		// address and nothing sets CF-Connecting-IP.
		const auth = authWith(CF_THEN_XFF);
		const lanA = { "x-forwarded-for": "192.0.2.10" };
		const lanB = { "x-forwarded-for": "192.0.2.11" };

		expect(await burst(auth, lanA, MAX + 1)).toEqual([200, 200, 429]);
		expect(await ok(auth, lanB)).toBe(200);
	});

	it("puts requests with no trustworthy header into one shared bucket, without touching identified clients", async () => {
		const auth = authWith(CF_THEN_XFF);
		const identified = { "cf-connecting-ip": "198.51.100.4" };

		// No header at all (never crossed the ingress) and a forwarded chain
		// (which the ingress never produces) both resolve to nothing. The
		// budget is shared between them and fails closed after MAX.
		expect(await ok(auth, {})).toBe(200);
		expect(
			await ok(auth, { "x-forwarded-for": "203.0.113.5, 203.0.113.6" }),
		).toBe(200);
		expect(await ok(auth, {})).toBe(429);
		expect(
			await ok(auth, { "x-forwarded-for": "203.0.113.7, 203.0.113.8" }),
		).toBe(429);

		// The shared bucket is not the identified clients' bucket.
		expect(await ok(auth, identified)).toBe(200);
	});

	it("with the unset default, a Cloudflare header alone resolves nothing", async () => {
		// What production looks like if TRUSTED_CLIENT_IP_HEADERS is forgotten:
		// the tunnel's own address is the only thing in X-Forwarded-For, so
		// every visitor shares cloudflared's bucket. The startup warning covers
		// this; the test pins that the default trusts nothing client-set.
		const auth = authWith([...DEFAULT_TRUSTED_CLIENT_IP_HEADERS]);
		const tunnel = "10.244.9.78";

		expect(
			await ok(auth, {
				"cf-connecting-ip": "198.51.100.5",
				"x-forwarded-for": tunnel,
			}),
		).toBe(200);
		expect(
			await ok(auth, {
				"cf-connecting-ip": "198.51.100.6",
				"x-forwarded-for": tunnel,
			}),
		).toBe(200);
		expect(
			await ok(auth, {
				"cf-connecting-ip": "198.51.100.7",
				"x-forwarded-for": tunnel,
			}),
		).toBe(429);
	});
});
