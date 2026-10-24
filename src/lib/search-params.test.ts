import { describe, expect, it } from "vitest";
import { parseSearch, stringifySearch } from "./search-params";

/**
 * The shape @better-auth/oauth-provider 1.7.5 redirects to `/login` with:
 * repeated `ba_param` names, numeric-looking `exp`/`ba_iat`, and a base64
 * `sig` that contains `+`, `/` and `=`.
 */
const SIGNED_LOGIN_QUERY =
	"?response_type=code&redirect_uri=https%3A%2F%2Fphotos.example.com%2Fauth%2Flogin" +
	"&scope=openid+profile+email&state=0123&client_id=immich" +
	"&code_challenge=lqPo10A3nYOBsc0r52AShTQ70g6EsSKFv1rev3sN9q0&code_challenge_method=S256" +
	"&exp=1792800543&ba_iat=1792799943253" +
	"&ba_param=ba_iat&ba_param=ba_param&ba_param=client_id&ba_param=code_challenge" +
	"&ba_param=code_challenge_method&ba_param=exp&ba_param=redirect_uri" +
	"&ba_param=response_type&ba_param=scope&ba_param=state" +
	"&sig=DL7XWrEt3bhAnOqOwLmrdsLrHJAcOCIejFp69CP%2BCRQ%3D";

function entries(search: string): [string, string][] {
	return [...new URLSearchParams(search)];
}

describe("parseSearch", () => {
	it("keeps every value a string", () => {
		expect(parseSearch("?exp=1792800543&flag=true&state=1e3")).toEqual({
			exp: "1792800543",
			flag: "true",
			state: "1e3",
		});
	});

	it("collects a repeated key into an array in order", () => {
		expect(parseSearch("a=1&b=x&a=2&a=3")).toEqual({
			a: ["1", "2", "3"],
			b: "x",
		});
	});

	it("returns an empty object for an empty query", () => {
		expect(parseSearch("")).toEqual({});
		expect(parseSearch("?")).toEqual({});
	});
});

describe("stringifySearch", () => {
	it("writes arrays back as repeated keys, not JSON", () => {
		expect(stringifySearch({ ba_param: ["a", "b"] })).toBe(
			"?ba_param=a&ba_param=b",
		);
	});

	it("omits undefined values and returns an empty string when nothing is left", () => {
		expect(stringifySearch({ redirect: undefined })).toBe("");
	});

	it("encodes a redirect target so it reads back unchanged", () => {
		const redirect = "https://app.example.com/x?y=1&z=a b#h";
		expect(parseSearch(stringifySearch({ redirect }))).toEqual({ redirect });
	});
});

describe("round trip", () => {
	it("preserves the signed OAuth login query (keys, order and values)", () => {
		const roundTripped = stringifySearch(parseSearch(SIGNED_LOGIN_QUERY));
		expect(entries(roundTripped)).toEqual(entries(SIGNED_LOGIN_QUERY));
	});

	it("is stable, so the router never rewrites the URL on load", () => {
		const once = stringifySearch(parseSearch(SIGNED_LOGIN_QUERY));
		expect(stringifySearch(parseSearch(once))).toBe(once);
		expect(once).toBe(SIGNED_LOGIN_QUERY);
	});
});
