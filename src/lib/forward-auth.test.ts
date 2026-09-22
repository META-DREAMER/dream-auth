import { describe, expect, it } from "vitest";
import {
	buildForwardAuthHeaders,
	FORWARD_AUTH_HEADERS,
	sanitizeHeaderValue,
} from "./forward-auth";

describe("sanitizeHeaderValue", () => {
	it("passes plain ASCII through", () => {
		expect(sanitizeHeaderValue("Ada Lovelace")).toBe("Ada Lovelace");
		expect(sanitizeHeaderValue("user@example.com")).toBe("user@example.com");
		expect(sanitizeHeaderValue("cmVhbGx5-l0ng_1d")).toBe("cmVhbGx5-l0ng_1d");
	});

	it("strips CR and LF, which would otherwise split the response", () => {
		expect(sanitizeHeaderValue("a\r\nX-Auth-Admin: true")).toBe(
			"aX-Auth-Admin: true",
		);
		expect(sanitizeHeaderValue("a\nb")).toBe("ab");
		expect(sanitizeHeaderValue("a\rb")).toBe("ab");
		expect(sanitizeHeaderValue("\r\n\r\n")).toBe("");
	});

	it("strips other control characters", () => {
		expect(sanitizeHeaderValue("a\u0000b")).toBe("ab");
		expect(sanitizeHeaderValue("a\tb")).toBe("ab");
		expect(sanitizeHeaderValue("a\u007fb")).toBe("ab");
		expect(sanitizeHeaderValue("a\u001bb")).toBe("ab");
	});

	it("drops non-ASCII rather than throwing when the Response is built", () => {
		expect(sanitizeHeaderValue("Jose Munoz")).toBe("Jose Munoz");
		expect(sanitizeHeaderValue("José Muñoz")).toBe("Jos Muoz");
		expect(sanitizeHeaderValue("山田太郎")).toBe("");
		expect(sanitizeHeaderValue("name \u{1f600}")).toBe("name");
	});

	it("trims and handles absent values", () => {
		expect(sanitizeHeaderValue("  padded  ")).toBe("padded");
		expect(sanitizeHeaderValue(null)).toBe("");
		expect(sanitizeHeaderValue(undefined)).toBe("");
		expect(sanitizeHeaderValue(42 as unknown as string)).toBe("");
	});
});

describe("buildForwardAuthHeaders", () => {
	const user = {
		id: "usr_01HZX",
		email: "ada@example.com",
		name: "Ada Lovelace",
	};

	it("emits every header named in the ingress annotation", () => {
		const headers = buildForwardAuthHeaders(user) as Record<string, string>;
		for (const name of FORWARD_AUTH_HEADERS) {
			expect(headers).toHaveProperty(name);
		}
	});

	it("carries the session identity", () => {
		expect(buildForwardAuthHeaders(user)).toMatchObject({
			"X-Auth-Id": "usr_01HZX",
			"X-Auth-User": "Ada Lovelace",
			"X-Auth-Email": "ada@example.com",
		});
	});

	it("keeps the decision out of caches", () => {
		expect(buildForwardAuthHeaders(user)).toMatchObject({
			"Cache-Control": "no-store",
		});
	});

	it("tolerates a missing display name", () => {
		expect(buildForwardAuthHeaders({ ...user, name: null })).toMatchObject({
			"X-Auth-User": "",
		});
		expect(buildForwardAuthHeaders({ id: "a", email: "b@c" })).toMatchObject({
			"X-Auth-User": "",
		});
	});

	it("survives a hostile display name", () => {
		const headers = buildForwardAuthHeaders({
			...user,
			name: "evil\r\nX-Auth-Id: root",
		});
		expect(headers).toMatchObject({
			"X-Auth-Id": "usr_01HZX",
			"X-Auth-User": "evilX-Auth-Id: root",
		});
		// The real proof: the Response constructor accepts it and the injected
		// name never becomes a second header.
		const response = new Response(null, { status: 200, headers });
		expect(response.headers.get("X-Auth-Id")).toBe("usr_01HZX");
	});

	it("produces headers a Response will actually accept", () => {
		const response = new Response(null, {
			status: 200,
			headers: buildForwardAuthHeaders({
				id: "usr_1",
				email: "josé@example.com",
				name: "José 山田 \u0000",
			}),
		});
		expect(response.status).toBe(200);
		expect(response.headers.get("X-Auth-User")).toBe("Jos");
		expect(response.headers.get("X-Auth-Email")).toBe("jos@example.com");
	});
});
