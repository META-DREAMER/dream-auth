import { describe, expect, it } from "vitest";
import {
	DEFAULT_REDIRECT,
	isInternalRedirect,
	type RedirectPolicy,
	resolveRedirectTarget,
	sanitizeRedirect,
} from "./policy";

/** Production shape: auth on a subdomain, session cookie on the parent. */
const POLICY: RedirectPolicy = {
	origin: "https://auth.example.com",
	cookieDomain: ".example.com",
};

/** Local development: no cookie domain, so nothing but the auth origin. */
const LOCAL: RedirectPolicy = { origin: "http://localhost:3000" };

/** Cookie domain written without the leading dot. */
const BARE_DOMAIN: RedirectPolicy = {
	origin: "https://auth.example.com",
	cookieDomain: "example.com",
};

function rejected(raw: string | null | undefined, policy = POLICY) {
	expect(sanitizeRedirect(raw, policy)).toBe(DEFAULT_REDIRECT);
}

describe("sanitizeRedirect", () => {
	describe("empty and non-string input", () => {
		it.each([undefined, null, "", "   ", "\t\n"])("rejects %j", (raw) => {
			rejected(raw as string | null | undefined);
		});

		it("rejects non-string values that slipped past the schema", () => {
			rejected(42 as unknown as string);
			rejected({} as unknown as string);
			rejected([] as unknown as string);
		});
	});

	describe("same-origin relative paths", () => {
		it.each([
			["/", "/"],
			["/org/members", "/org/members"],
			["/org/members?tab=invites", "/org/members?tab=invites"],
			[
				"/consent?code=abc&client_id=grafana",
				"/consent?code=abc&client_id=grafana",
			],
			["/settings#tokens", "/settings#tokens"],
			["/a/b/c?x=1#y", "/a/b/c?x=1#y"],
			// Percent-encoded slashes stay encoded in the path; browsers do not
			// decode them into a new authority, so this remains same-origin.
			["/%2F%2Fevil.com", "/%2F%2Fevil.com"],
			["/%2f%2fevil.com", "/%2f%2fevil.com"],
			// Dot segments are normalised by the URL parser, and cannot escape
			// an origin.
			["/../../etc/passwd", "/etc/passwd"],
			["/a/../b", "/b"],
		])("accepts %j", (raw, expected) => {
			expect(sanitizeRedirect(raw, POLICY)).toBe(expected);
		});

		it("preserves the path shape under the local policy too", () => {
			expect(sanitizeRedirect("/org/members", LOCAL)).toBe("/org/members");
		});
	});

	describe("protocol-relative URLs", () => {
		it.each([
			"//evil.com",
			"//evil.com/",
			"//evil.com/path?x=1",
			"///evil.com",
			"////evil.com",
			"//example.com.evil.com",
			// Backslashes: browsers and the WHATWG parser treat them as slashes
			// for special schemes, so each of these is an authority in disguise.
			"/\\evil.com",
			"\\\\evil.com",
			"\\/evil.com",
			"/\\/evil.com",
			"//\\evil.com",
		])("rejects %j", (raw) => {
			rejected(raw);
		});

		it("rejects a protocol-relative URL onto an allowed host as well", () => {
			// It resolves to https://app.example.com, which is allowed on host,
			// but we only reach that through an explicit scheme. Confirm the
			// actual behaviour rather than assuming it.
			expect(sanitizeRedirect("//app.example.com/x", POLICY)).toBe(
				"https://app.example.com/x",
			);
		});
	});

	describe("off-domain absolute URLs", () => {
		it.each([
			"https://evil.com",
			"https://evil.com/login",
			"http://evil.com",
			"https://example.com.evil.com/",
			"https://evilexample.com/",
			"https://notexample.com/",
			// Suffix confusion: the allowed domain must be a *label* boundary.
			"https://xexample.com/",
			"https://example.como/",
			// Allowed domain appearing anywhere but the host.
			"https://evil.com/?next=https://app.example.com",
			"https://evil.com/#https://app.example.com",
			"https://evil.com/app.example.com",
			// Raw IP literals are never the cookie domain.
			"https://127.0.0.1/",
			"https://[::1]/",
			"https://169.254.169.254/latest/meta-data/",
		])("rejects %j", (raw) => {
			rejected(raw);
		});
	});

	describe("embedded credentials", () => {
		it.each([
			"https://auth.example.com@evil.com/",
			"https://app.example.com@evil.com/",
			"https://user:pass@evil.com/",
			"https://evil.com@app.example.com/",
			"https://auth.example.com%40evil.com/",
			"https://:@evil.com/",
		])("rejects %j", (raw) => {
			rejected(raw);
		});

		it("rejects credentials even when the host itself is allowed", () => {
			rejected("https://someone@app.example.com/");
			rejected("https://u:p@app.example.com/");
		});
	});

	describe("dangerous schemes", () => {
		it.each([
			"javascript:alert(1)",
			"JavaScript:alert(1)",
			"JAVASCRIPT:alert(document.domain)",
			"jAvAsCrIpT:alert(1)",
			"javascript:void(0)",
			"data:text/html,<script>alert(1)</script>",
			"DATA:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
			"vbscript:msgbox(1)",
			"blob:https://auth.example.com/abc",
			"file:///etc/passwd",
			"mailto:a@b.com",
			"tel:+15550000",
			"ftp://evil.com/",
			"ws://evil.com/",
			"wss://app.example.com/",
			"about:blank",
			"chrome://settings",
			"intent://evil#Intent;scheme=https;end",
		])("rejects %j", (raw) => {
			rejected(raw);
		});

		it("rejects control-character splits that browsers would reassemble", () => {
			// A browser strips tab/LF/CR from URLs, so each of these is
			// `javascript:alert(1)` by the time it is navigated.
			rejected("java\tscript:alert(1)");
			rejected("java\nscript:alert(1)");
			rejected("java\rscript:alert(1)");
			rejected("\u0000javascript:alert(1)");
			rejected(" javascript:alert(1)");
			rejected("java\u0000script:alert(1)");
		});

		it("rejects other embedded control characters", () => {
			rejected("/path\u0000/x");
			rejected("/path\u000b/x");
			rejected("/path\u007f/x");
			rejected("https://app.example.com/\u0001");
		});
	});

	describe("case variations", () => {
		it.each([
			"HTTPS://EVIL.COM/",
			"HtTpS://EvIl.CoM/",
			"https://EVIL.COM/",
			"HTTPS://EXAMPLE.COM.EVIL.COM/",
		])("rejects %j", (raw) => {
			rejected(raw);
		});

		it("accepts an allowed host regardless of case", () => {
			expect(sanitizeRedirect("HTTPS://APP.EXAMPLE.COM/x", POLICY)).toBe(
				"https://app.example.com/x",
			);
			expect(sanitizeRedirect("https://App.Example.Com/x", POLICY)).toBe(
				"https://app.example.com/x",
			);
		});

		it("accepts a case-varied cookie domain in the policy", () => {
			expect(
				sanitizeRedirect("https://app.example.com/x", {
					origin: "https://auth.example.com",
					cookieDomain: ".EXAMPLE.COM",
				}),
			).toBe("https://app.example.com/x");
		});
	});

	describe("sibling hosts under the cookie domain", () => {
		it.each([
			["https://app.example.com", "https://app.example.com/"],
			["https://app.example.com/", "https://app.example.com/"],
			[
				"https://grafana.example.com/d/abc?x=1",
				"https://grafana.example.com/d/abc?x=1",
			],
			[
				"https://deep.nested.app.example.com/x",
				"https://deep.nested.app.example.com/x",
			],
			// The apex itself.
			["https://example.com/", "https://example.com/"],
			// The auth host reached absolutely comes back as a path.
			["https://auth.example.com/org/members", "/org/members"],
			["https://auth.example.com/", "/"],
		])("accepts %j", (raw, expected) => {
			expect(sanitizeRedirect(raw, POLICY)).toBe(expected);
		});

		it("accepts the same set when the cookie domain has no leading dot", () => {
			expect(sanitizeRedirect("https://app.example.com/x", BARE_DOMAIN)).toBe(
				"https://app.example.com/x",
			);
			expect(sanitizeRedirect("https://evil.com/x", BARE_DOMAIN)).toBe(
				DEFAULT_REDIRECT,
			);
		});

		it("tolerates a trailing root dot on an allowed host", () => {
			expect(sanitizeRedirect("https://app.example.com./x", POLICY)).toBe(
				"https://app.example.com./x",
			);
		});

		it("requires TLS for cross-origin destinations", () => {
			rejected("http://app.example.com/x");
			rejected("http://example.com/x");
		});

		it("rejects a sibling host on a non-default port only if the host is wrong", () => {
			expect(sanitizeRedirect("https://app.example.com:8443/x", POLICY)).toBe(
				"https://app.example.com:8443/x",
			);
			rejected("https://evil.com:8443/x");
		});
	});

	describe("no cookie domain configured", () => {
		it("allows only the auth origin", () => {
			expect(sanitizeRedirect("/org/members", LOCAL)).toBe("/org/members");
			expect(sanitizeRedirect("http://localhost:3000/org", LOCAL)).toBe("/org");
			rejected("https://app.example.com/x", LOCAL);
			rejected("http://localhost:3001/x", LOCAL);
			rejected("http://127.0.0.1:3000/x", LOCAL);
			// A protocol-relative URL onto the auth origin itself resolves back
			// to the auth origin and collapses to a path - safe, not a bypass.
			expect(sanitizeRedirect("//localhost:3000/x", LOCAL)).toBe("/x");
			rejected("//localhost:3001/x", LOCAL);
		});
	});

	describe("degenerate policies", () => {
		it("refuses a cookie domain with no dot, which would open a public suffix", () => {
			const policy = {
				origin: "https://auth.example.com",
				cookieDomain: "com",
			};
			rejected("https://evil.com/", policy);
			rejected("https://example.com/", policy);
			expect(sanitizeRedirect("/x", policy)).toBe("/x");
		});

		it("refuses a bare-dot or empty cookie domain", () => {
			rejected("https://evil.com/", {
				origin: "https://auth.example.com",
				cookieDomain: ".",
			});
			rejected("https://evil.com/", {
				origin: "https://auth.example.com",
				cookieDomain: "",
			});
			rejected("https://evil.com/", {
				origin: "https://auth.example.com",
				cookieDomain: "localhost",
			});
		});

		it("falls back when the policy origin is unparseable", () => {
			expect(sanitizeRedirect("/x", { origin: "not a url" })).toBe(
				DEFAULT_REDIRECT,
			);
		});
	});

	describe("length and malformed input", () => {
		it("rejects an over-long target", () => {
			rejected(`/${"a".repeat(2048)}`);
		});

		it("accepts a long-but-bounded target", () => {
			const path = `/${"a".repeat(2000)}`;
			expect(sanitizeRedirect(path, POLICY)).toBe(path);
		});

		it("rejects bare hostnames with no scheme and no leading slash", () => {
			rejected("evil.com");
			rejected("evil.com/path");
			rejected("app.example.com");
			rejected("org/members");
			rejected("./relative");
			rejected("../relative");
			rejected("?next=/x");
			rejected("#fragment");
		});

		it("rejects garbage that still parses", () => {
			rejected("https://");
			rejected("https:///evil.com");
			rejected("http://[not-an-ip]/");
		});

		it("trims surrounding whitespace before deciding", () => {
			expect(sanitizeRedirect("  /org/members  ", POLICY)).toBe("/org/members");
			rejected("  https://evil.com  ");
		});
	});

	describe("double-encoding and nesting", () => {
		it.each([
			"/%252f%252fevil.com",
			"https%3A%2F%2Fevil.com",
			"%68ttps://evil.com",
			// A hostile target nested in a same-origin query string is harmless:
			// the next hop sanitizes it again before anything navigates.
			"/login?redirect=https://evil.com",
		])("keeps %j on an allowed origin", (raw) => {
			const result = sanitizeRedirect(raw, POLICY);
			const resolved = new URL(result, POLICY.origin);
			expect(resolved.hostname).toBe("auth.example.com");
		});
	});

	it("is idempotent: sanitizing its own output is a fixed point", () => {
		const inputs = [
			"/org/members?x=1#y",
			"https://app.example.com/x",
			"https://evil.com/x",
			"javascript:alert(1)",
			"//evil.com",
			"/../etc",
		];
		for (const raw of inputs) {
			const once = sanitizeRedirect(raw, POLICY);
			expect(sanitizeRedirect(once, POLICY)).toBe(once);
		}
	});

	it("never returns a value that navigates off the allowed domains", () => {
		const hostile = [
			"https://evil.com",
			"//evil.com",
			"/\\evil.com",
			"javascript:alert(1)",
			"https://auth.example.com@evil.com",
			"HTTPS://EVIL.COM",
			"\\\\evil.com",
			"data:text/html,x",
			"https://example.com.evil.com",
		];
		for (const raw of hostile) {
			const result = sanitizeRedirect(raw, POLICY);
			const resolved = new URL(result, POLICY.origin);
			expect(resolved.protocol).toBe("https:");
			expect(
				resolved.hostname === "example.com" ||
					resolved.hostname.endsWith(".example.com"),
			).toBe(true);
		}
	});
});

describe("resolveRedirectTarget", () => {
	it("uses `redirect` when present", () => {
		expect(resolveRedirectTarget({ redirect: "/a", rd: "/b" }, POLICY)).toBe(
			"/a",
		);
	});

	it("falls back to the nginx `rd` alias", () => {
		expect(resolveRedirectTarget({ rd: "/b" }, POLICY)).toBe("/b");
	});

	it("falls back to `rd` when `redirect` is an empty string", () => {
		// An empty `redirect` is indistinguishable from an absent one for our
		// purposes, and the nullish coalescing keeps it as the winner - which
		// still sanitizes to "/". Pin the behaviour so it cannot drift silently.
		expect(resolveRedirectTarget({ redirect: "", rd: "/b" }, POLICY)).toBe("/");
	});

	it("validates `rd` exactly like `redirect`", () => {
		expect(resolveRedirectTarget({ rd: "https://evil.com" }, POLICY)).toBe("/");
		expect(resolveRedirectTarget({ rd: "//evil.com" }, POLICY)).toBe("/");
		expect(resolveRedirectTarget({ rd: "javascript:alert(1)" }, POLICY)).toBe(
			"/",
		);
	});

	it("accepts the absolute URL ingress-nginx actually emits", () => {
		expect(
			resolveRedirectTarget(
				{ rd: "https://app.example.com/dashboard?tab=1" },
				POLICY,
			),
		).toBe("https://app.example.com/dashboard?tab=1");
	});

	it("returns the default for an empty search object", () => {
		expect(resolveRedirectTarget({}, POLICY)).toBe("/");
	});
});

describe("isInternalRedirect", () => {
	it.each(["/", "/org/members", "/a?b=c#d"])("treats %j as internal", (v) => {
		expect(isInternalRedirect(v)).toBe(true);
	});

	it.each([
		"https://app.example.com/x",
		"//evil.com",
	])("treats %j as external", (v) => {
		expect(isInternalRedirect(v)).toBe(false);
	});
});
