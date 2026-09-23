/**
 * Client IP resolution for rate limiting and session IP tracking.
 *
 * better-auth keys its rate limiter on `getIP()` (`@better-auth/core/utils/ip`),
 * which walks `advanced.ipAddress.ipAddressHeaders` in order and takes the
 * first header that yields exactly one valid address. Since 1.6.17 / 1.6.21 it
 * refuses to guess: a comma-separated chain is only honoured with
 * `trustedProxies`, and an unresolvable IP falls into one shared per-path
 * bucket with a startup warning. That refusal closed a real bypass (a client
 * setting `X-Forwarded-For` picked its own bucket), so this module must not
 * reopen it.
 *
 * ## Threat model
 *
 * Production path: client → Cloudflare edge → cloudflared (in-cluster) →
 * ingress controller → this pod. What the pod receives was measured, not
 * inferred (an echo request through ingress-nginx with forged headers):
 *
 * | Header                | Value at the pod                                  |
 * | --------------------- | ------------------------------------------------- |
 * | `X-Forwarded-For`     | overwritten by the ingress with its peer address  |
 * | `X-Real-IP`           | same as above                                     |
 * | `CF-Connecting-IP`    | passed through untouched                          |
 * | `True-Client-IP`      | passed through untouched                          |
 *
 * The ingress only rewrites its peer address from `CF-Connecting-IP` when the
 * peer is inside Cloudflare's published ranges, and cloudflared is a pod, so
 * on the tunnel path the peer is cloudflared and `X-Forwarded-For` is a pod
 * IP shared by every visitor. The only header that carries the real client on
 * that path is `CF-Connecting-IP`, and on that path it cannot be forged:
 * Cloudflare's edge sets it on every request it proxies, and the tunnel is
 * not reachable without going through the edge.
 *
 * `True-Client-IP` is not equivalent. Cloudflare only adds it through an
 * Enterprise-plan managed transform; otherwise it is whatever the visitor sent.
 *
 * ## Residual risk: the LAN path
 *
 * The ingress also has a LAN load-balancer address. A client on the LAN (or
 * on the WireGuard network that lands on it) reaches the ingress without
 * crossing Cloudflare, and nothing on that path strips `CF-Connecting-IP`, so
 * such a client can forge it and choose its own rate-limit bucket, or fill a
 * specific remote address's bucket. Accepted because the LAN is already a
 * trusted boundary (it can reach every cluster service directly), and noted
 * here so the assumption is visible. Closing it needs the ingress to drop
 * inbound `CF-Connecting-IP` unless the peer is cloudflared; ingress-nginx
 * cannot do that without a snippet annotation, Traefik can with a headers
 * middleware keyed on an IP allow-list.
 *
 * `x-forwarded-for` is kept as the fallback so LAN clients get their own
 * bucket too: the ingress overwrites it with the peer address on every path,
 * so it is never client-controlled. Listing it first would shadow
 * `cf-connecting-ip` on the tunnel path, so order matters and is warned on.
 *
 * ## Traefik migration
 *
 * The decision survives the move to Traefik only if (1)
 * `forwardedHeaders.trustedIPs` never includes the pod CIDR or the LAN, so the
 * tunnel hop keeps `X-Forwarded-For` single-valued and peer-set, and (2) no
 * middleware rewrites or strips `CF-Connecting-IP`. Re-run the echo probe after
 * the migration and confirm the table above still holds.
 *
 * ## Fail-safe
 *
 * better-auth 1.7.5 exposes no per-request hook for an unresolvable IP: the
 * choice is the shared `no-trusted-ip` bucket or `disableIpTracking`, which
 * turns rate limiting off entirely. The shared bucket is the fail-closed
 * option, so it stays. With `x-forwarded-for` as the last resort it is only
 * reachable by traffic that never crossed the ingress (in-cluster callers) or
 * that presents a forwarded chain the ingress never produces.
 */

/**
 * Cloudflare's per-request client IP header. Set by the edge on every proxied
 * request; never trust it on a path that does not cross the edge.
 */
export const CLOUDFLARE_CLIENT_IP_HEADER = "cf-connecting-ip";

/**
 * The header the ingress overwrites with its peer address on every path. Safe
 * as a last resort because it is never client-controlled, but on the tunnel
 * path it is cloudflared's own address, not the visitor's.
 */
export const INGRESS_PEER_IP_HEADER = "x-forwarded-for";

/**
 * Default when `TRUSTED_CLIENT_IP_HEADERS` is unset: better-auth's own
 * default. Nothing client-controlled is trusted out of the box, so an
 * operator who forgets the variable degrades to a shared bucket behind
 * Cloudflare rather than opening a bypass. Production logs a warning.
 */
export const DEFAULT_TRUSTED_CLIENT_IP_HEADERS: readonly string[] = [
	INGRESS_PEER_IP_HEADER,
];

/**
 * Headers with a documented meaning here. Anything else is accepted but
 * warned about, since the whole scheme rests on the proxy overwriting it.
 */
const KNOWN_CLIENT_IP_HEADERS = new Set([
	CLOUDFLARE_CLIENT_IP_HEADER,
	INGRESS_PEER_IP_HEADER,
	"x-real-ip",
	"true-client-ip",
]);

const ENTERPRISE_ONLY_HEADER = "true-client-ip";

export type ClientIpAdvancedOptions = {
	ipAddress: {
		ipAddressHeaders: string[];
	};
};

/**
 * Parse `TRUSTED_CLIENT_IP_HEADERS`: a comma-separated, ordered list of header
 * names, first resolvable wins. Names are lower-cased (header lookups are
 * case-insensitive but better-auth compares the configured string as-is),
 * blanks are dropped and duplicates collapse to their first position. An
 * empty or unset value yields the default.
 */
export function parseTrustedClientIpHeaders(raw: string | undefined): string[] {
	const headers: string[] = [];
	for (const entry of (raw ?? "").split(",")) {
		const name = entry.trim().toLowerCase();
		if (name && !headers.includes(name)) headers.push(name);
	}
	return headers.length > 0 ? headers : [...DEFAULT_TRUSTED_CLIENT_IP_HEADERS];
}

/**
 * The `advanced` fragment that tells better-auth which headers to resolve the
 * client IP from. Spread into `advanced` alongside the cookie options.
 */
export function buildClientIpAdvancedOptions(
	headers: readonly string[],
): ClientIpAdvancedOptions {
	return { ipAddress: { ipAddressHeaders: [...headers] } };
}

/**
 * Startup warnings for configurations that are legal but ambiguous. Each one
 * names the consequence and the fix; none of them stops the server, because
 * the failure mode in every case is a degraded bucket, not a bypass.
 */
export function clientIpConfigWarnings(
	headers: readonly string[],
	context: { configured: boolean; production: boolean },
): string[] {
	const warnings: string[] = [];

	if (!context.configured && context.production) {
		warnings.push(
			`TRUSTED_CLIENT_IP_HEADERS is not set; resolving the client IP from ${INGRESS_PEER_IP_HEADER} only. ` +
				"Behind a Cloudflare tunnel that header carries cloudflared's own address, so every visitor shares one rate-limit bucket. " +
				`Set TRUSTED_CLIENT_IP_HEADERS=${CLOUDFLARE_CLIENT_IP_HEADER},${INGRESS_PEER_IP_HEADER}.`,
		);
	}

	if (headers.includes(ENTERPRISE_ONLY_HEADER)) {
		warnings.push(
			`${ENTERPRISE_ONLY_HEADER} is trusted, but Cloudflare only sets it through an Enterprise managed transform; ` +
				`on every other plan it is whatever the visitor sent. Use ${CLOUDFLARE_CLIENT_IP_HEADER} instead.`,
		);
	}

	const peerIndex = headers.indexOf(INGRESS_PEER_IP_HEADER);
	if (peerIndex === -1) {
		warnings.push(
			`${INGRESS_PEER_IP_HEADER} is not in TRUSTED_CLIENT_IP_HEADERS; requests that reach the ingress without crossing ` +
				`Cloudflare (for example from the LAN) carry none of [${headers.join(", ")}] and will share one rate-limit bucket. ` +
				"Append it as the last entry.",
		);
	} else if (peerIndex !== headers.length - 1) {
		warnings.push(
			`${INGRESS_PEER_IP_HEADER} is listed before [${headers.slice(peerIndex + 1).join(", ")}]. The ingress sets it on every ` +
				"request, so the later headers are never consulted and tunnel traffic collapses to cloudflared's address. Move it last.",
		);
	}

	for (const header of headers) {
		if (!KNOWN_CLIENT_IP_HEADERS.has(header)) {
			warnings.push(
				`${header} is not a header this deployment documents. It is only safe if the proxy in front overwrites it ` +
					"on every path a client can take; a header the client can set picks its own rate-limit bucket.",
			);
		}
	}

	return warnings;
}

/**
 * The production build evaluates `auth.ts` twice - once in the server entry
 * and once in the SSR chunk - so a plain module-level "already warned" flag
 * would still print every warning twice. The guard lives on `globalThis`
 * under a registered symbol so it is shared by every copy of this module in
 * the process.
 */
const WARNED = Symbol.for("dream-auth.client-ip.warned");

export function logClientIpConfigWarnings(
	headers: readonly string[],
	context: { configured: boolean; production: boolean },
	warn: (message: string) => void = console.warn,
): void {
	const flags = globalThis as { [WARNED]?: boolean };
	if (flags[WARNED]) return;
	flags[WARNED] = true;
	for (const warning of clientIpConfigWarnings(headers, context)) {
		warn(`[client-ip] ${warning}`);
	}
}
