import { describe, expect, it } from "vitest";
import { buildAllowInsecureRedirectUri } from "./insecure-redirect";

describe("buildAllowInsecureRedirectUri", () => {
	it("is disabled for an HTTPS server", () => {
		expect(
			buildAllowInsecureRedirectUri("https://auth.md.wtf"),
		).toBeUndefined();
	});

	it("is disabled for a plain-HTTP server that is not loopback", () => {
		expect(
			buildAllowInsecureRedirectUri("http://192.168.1.10:3000"),
		).toBeUndefined();
	});

	it.each([
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://[::1]:3000",
		"http://app.localhost",
	])("accepts loopback redirects when the server is %s", (server) => {
		const allow = buildAllowInsecureRedirectUri(server);
		expect(allow?.(new URL("http://localhost:4000/callback"))).toBe(true);
		expect(allow?.(new URL("http://127.0.0.1/callback"))).toBe(true);
	});

	it.each([
		"http://192.168.1.10/callback",
		"http://example.com/callback",
		"http://localhost.evil.com/callback",
		"http://127.0.0.1.nip.io/callback",
	])("rejects the non-loopback redirect %s", (redirect) => {
		const allow = buildAllowInsecureRedirectUri("http://localhost:3000");
		expect(allow?.(new URL(redirect))).toBe(false);
	});
});
