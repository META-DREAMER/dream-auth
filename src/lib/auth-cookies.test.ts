import { getCookies } from "better-auth/cookies";
import { describe, expect, it } from "vitest";
import { buildCookieAdvancedOptions } from "@/lib/auth-cookies";

/**
 * These assert the cookies better-auth actually produces, by feeding our
 * `advanced` fragment to the same `getCookies()` the auth instance uses. A
 * test against our own return value would only prove we agree with ourselves.
 */
function cookiesFor({
	cookieDomain,
	baseURL = "https://auth.example.com",
}: {
	cookieDomain?: string;
	baseURL?: string;
}) {
	return getCookies({
		baseURL,
		advanced: buildCookieAdvancedOptions(cookieDomain),
	});
}

describe("buildCookieAdvancedOptions", () => {
	it("enables cross-subdomain cookies for a configured domain", () => {
		expect(buildCookieAdvancedOptions("example.com")).toEqual({
			crossSubDomainCookies: { enabled: true, domain: "example.com" },
		});
	});

	it("strips a legacy leading dot", () => {
		expect(
			buildCookieAdvancedOptions(".example.com").crossSubDomainCookies?.domain,
		).toBe("example.com");
	});

	it.each([
		undefined,
		"",
		"   ",
		".",
	])("returns an empty fragment for %p", (value) => {
		expect(buildCookieAdvancedOptions(value)).toEqual({});
	});
});

describe("session cookie domain", () => {
	it("carries the Domain attribute when COOKIE_DOMAIN is set", () => {
		const cookies = cookiesFor({ cookieDomain: ".example.com" });
		expect(cookies.sessionToken.attributes.domain).toBe("example.com");
	});

	it("omits the Domain attribute when COOKIE_DOMAIN is unset", () => {
		const cookies = cookiesFor({
			cookieDomain: undefined,
			baseURL: "http://localhost:3000",
		});
		expect(cookies.sessionToken.attributes.domain).toBeUndefined();
	});

	it("scopes every auth cookie, not just the session token", () => {
		const cookies = cookiesFor({ cookieDomain: "example.com" });
		for (const cookie of [
			cookies.sessionToken,
			cookies.sessionData,
			cookies.dontRememberToken,
		]) {
			expect(cookie.attributes.domain).toBe("example.com");
		}
	});
});

describe("session cookie hardening", () => {
	it("stays httpOnly, lax and path-scoped in both configurations", () => {
		for (const cookieDomain of [undefined, "example.com"]) {
			const { attributes } = cookiesFor({ cookieDomain }).sessionToken;
			expect(attributes.httpOnly).toBe(true);
			expect(attributes.sameSite).toBe("lax");
			expect(attributes.path).toBe("/");
		}
	});

	it("marks the cookie secure behind https", () => {
		expect(
			cookiesFor({ cookieDomain: "example.com" }).sessionToken.attributes
				.secure,
		).toBe(true);
	});

	it("does not mark the cookie secure on a plain-http localhost", () => {
		const { name, attributes } = cookiesFor({
			cookieDomain: undefined,
			baseURL: "http://localhost:3000",
		}).sessionToken;

		expect(attributes.secure).toBe(false);
		// A __Secure- prefixed cookie without the secure flag is rejected
		// outright by browsers, which would break local development.
		expect(name).not.toContain("__Secure-");
	});
});
