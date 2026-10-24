/**
 * Search param (de)serialization for the router that keeps the query string
 * exactly as the server wrote it.
 *
 * TanStack Router's default JSON serializer is lossy for URLs this app does
 * not build itself. On load it parses the query (repeated keys become an
 * array, numeric-looking values become numbers) and, when re-serializing that
 * object gives a different string, it replaces the URL. A repeated key comes
 * back as one JSON-encoded value: `ba_param=a&ba_param=b` turns into
 * `ba_param=["a","b"]`.
 *
 * That breaks the OAuth login. @better-auth/oauth-provider sends the browser
 * to `/login?...&ba_param=<name>&ba_param=<name>...&sig=...`, and
 * `oauthProviderClient()` re-reads `window.location.search` to attach the
 * signed `oauth_query` to every sign-in POST. After the rewrite the signature
 * no longer matches and the server answers 400 `invalid_signature` with no
 * `message`, which the login page showed as "Passkey authentication failed"
 * (or "Invalid credentials" for email/password).
 *
 * Every search param in this app is a plain string, so values stay strings:
 * a key that appears once is a string, a repeated key is a string array, and
 * stringifying writes the array back as repeated keys in the same order.
 */

export type RawSearch = Record<string, string | string[]>;

export function parseSearch(searchStr: string): RawSearch {
	const params = new URLSearchParams(
		searchStr.startsWith("?") ? searchStr.slice(1) : searchStr,
	);
	const result: RawSearch = {};
	for (const [key, value] of params) {
		const previous = result[key];
		if (previous === undefined) result[key] = value;
		else if (Array.isArray(previous)) previous.push(value);
		else result[key] = [previous, value];
	}
	return result;
}

function stringifyValue(value: unknown): string {
	return typeof value === "object" && value !== null
		? JSON.stringify(value)
		: String(value);
}

export function stringifySearch(search: Record<string, unknown>): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(search)) {
		if (value === undefined) continue;
		for (const item of Array.isArray(value) ? value : [value]) {
			params.append(key, stringifyValue(item));
		}
	}
	const searchStr = params.toString();
	return searchStr ? `?${searchStr}` : "";
}
