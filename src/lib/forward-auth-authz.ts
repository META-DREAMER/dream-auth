/**
 * Per-app authorization for the forward-auth endpoint (`/api/verify`).
 *
 * Authentication says who the user is; this module says whether that user may
 * reach the app in front of them. The rule set is deliberately tiny:
 *
 * - One organization authorizes everything, pinned by **id** in
 *   `FORWARD_AUTH_ORG_ID`. Never by slug: any user who can create an
 *   organization can pick its slug, and a slug-keyed check would let them
 *   mint their own "home".
 * - What each app requires is written on the verify URL in the proxy's own
 *   config (`?team=media`, `?role=admin`). Traefik copies the middleware's
 *   `address` verbatim onto the auth subrequest, so those parameters are set
 *   by whoever writes the cluster manifests and by nobody else. The client's
 *   original URL arrives separately, in `X-Forwarded-Uri`, and is never
 *   consulted here: a `?team=admin` on the app URL changes nothing.
 * - With no parameter, membership of the pinned org (any role) is enough.
 *   `role=admin` needs owner or admin. `team=<name>` needs owner or admin,
 *   or membership of that team (matched case-insensitively and exactly).
 *   A team that does not exist in the org is a deny, logged by name, so a
 *   typo in a middleware cannot open anything.
 *
 * Everything here is pure so the decision table can be tested exhaustively;
 * the database lookup lives in `src/lib/org-access.ts`.
 */

/** Query parameters on the verify URL, and nowhere else. */
export const FORWARD_AUTH_TEAM_PARAM = "team";
export const FORWARD_AUTH_ROLE_PARAM = "role";

/** Roles that satisfy `role=admin` and that bypass a `team=` requirement. */
const ELEVATED_ROLES = new Set(["owner", "admin"]);

export function isElevatedRole(role: string): boolean {
	return ELEVATED_ROLES.has(role);
}

/** What the pinned organization knows about one user. */
export interface OrgAccess {
	/** The user's `member.role` in the pinned org. */
	role: string;
	/**
	 * Every team in the org, with whether the user belongs to it. All teams
	 * are listed (not only the user's) so that an unknown team in a
	 * middleware can be told apart from a team the user is simply not in.
	 */
	teams: ReadonlyArray<{ name: string; isMember: boolean }>;
}

/** Parsed from the verify URL; `error` means the URL itself is malformed. */
export type AuthzRequirement =
	| { kind: "member" }
	| { kind: "role"; role: "admin" }
	| { kind: "team"; team: string }
	| { kind: "invalid"; reason: string };

/**
 * Read the requirement off the verify request's own URL.
 *
 * Present-but-not-understood is `invalid`, which the endpoint turns into a
 * deny: a middleware with `role=admn` should lock people out loudly rather
 * than quietly fall back to "any member".
 */
export function parseAuthzRequirement(url: URL): AuthzRequirement {
	const role = url.searchParams.get(FORWARD_AUTH_ROLE_PARAM);
	const team = url.searchParams.get(FORWARD_AUTH_TEAM_PARAM);

	if (role !== null && team !== null) {
		return {
			kind: "invalid",
			reason: "both role= and team= on the verify URL; use one",
		};
	}
	if (role !== null) {
		if (role !== "admin") {
			return {
				kind: "invalid",
				reason: `unsupported role requirement ${JSON.stringify(role)}; only role=admin is defined`,
			};
		}
		return { kind: "role", role: "admin" };
	}
	if (team !== null) {
		const name = team.trim();
		if (!name) {
			return { kind: "invalid", reason: "empty team= on the verify URL" };
		}
		return { kind: "team", team: name };
	}
	return { kind: "member" };
}

export type AuthzDecision =
	| { allowed: true; groups: string[] }
	| { allowed: false; reason: string };

/**
 * The decision table. `access` is `null` when the user is not a member of the
 * pinned organization at all.
 */
export function authorize(
	access: OrgAccess | null,
	requirement: AuthzRequirement,
): AuthzDecision {
	if (requirement.kind === "invalid") {
		return { allowed: false, reason: requirement.reason };
	}
	if (!access) {
		return { allowed: false, reason: "not a member of the authorizing org" };
	}

	const groups = buildGroups(access);

	switch (requirement.kind) {
		case "member":
			return { allowed: true, groups };

		case "role":
			if (isElevatedRole(access.role)) return { allowed: true, groups };
			return {
				allowed: false,
				reason: `role=admin requires owner or admin, user is ${access.role}`,
			};

		case "team": {
			if (isElevatedRole(access.role)) return { allowed: true, groups };
			const wanted = requirement.team.toLowerCase();
			const team = access.teams.find((t) => t.name.toLowerCase() === wanted);
			if (!team) {
				return {
					allowed: false,
					reason: `team ${JSON.stringify(requirement.team)} does not exist in the authorizing org`,
				};
			}
			if (team.isMember) return { allowed: true, groups };
			return {
				allowed: false,
				reason: `user is not a member of team ${JSON.stringify(team.name)}`,
			};
		}
	}
}

/**
 * `role:<role>` plus one `team:<name>` per team the user belongs to, in the
 * pinned org. This is the `X-Auth-Groups` payload before header sanitizing.
 */
export function buildGroups(access: OrgAccess): string[] {
	return [
		`role:${access.role}`,
		...access.teams.filter((t) => t.isMember).map((t) => `team:${t.name}`),
	];
}

/** How the endpoint asks who a user is in an org. Swapped out in tests. */
export interface OrgAccessLookup {
	getOrgAccess(userId: string, orgId: string): Promise<OrgAccess | null>;
}

/** Default TTL for {@link createCachedOrgAccessLookup}. */
export const ORG_ACCESS_CACHE_TTL_MS = 30_000;

/** Upper bound on cached entries; the oldest is evicted past it. */
const ORG_ACCESS_CACHE_MAX_ENTRIES = 10_000;

/**
 * In-process cache in front of a lookup, keyed by user and org.
 *
 * The verify endpoint runs on every request to every protected app, and
 * membership changes rarely, so a short TTL removes the membership query from
 * the hot path at the cost of one known trade-off: **revoking access takes
 * effect within the TTL, not instantly.** Removing a user from the org or a
 * team keeps working for up to 30 seconds on each replica. Deleting the user
 * or signing them out is still immediate, because the session check comes
 * first and is never cached.
 *
 * Denials are cached too, so a freshly granted user may also wait up to the
 * TTL, and a 403 page that is reloaded in a loop does not become a query
 * storm. Errors are never cached: a failed lookup propagates and is retried
 * on the next request.
 */
export function createCachedOrgAccessLookup(
	inner: OrgAccessLookup,
	options: { ttlMs?: number; now?: () => number } = {},
): OrgAccessLookup & { clear(): void } {
	const ttlMs = options.ttlMs ?? ORG_ACCESS_CACHE_TTL_MS;
	const now = options.now ?? Date.now;
	const cache = new Map<
		string,
		{ expiresAt: number; value: OrgAccess | null }
	>();

	return {
		async getOrgAccess(userId, orgId) {
			const key = `${userId}\u0000${orgId}`;
			const hit = cache.get(key);
			const at = now();
			if (hit && hit.expiresAt > at) return hit.value;

			const value = await inner.getOrgAccess(userId, orgId);

			if (cache.size >= ORG_ACCESS_CACHE_MAX_ENTRIES) {
				const oldest = cache.keys().next().value;
				if (oldest !== undefined) cache.delete(oldest);
			}
			cache.set(key, { expiresAt: at + ttlMs, value });
			return value;
		},
		clear() {
			cache.clear();
		},
	};
}

/**
 * Startup warning for the legacy configuration. Without `FORWARD_AUTH_ORG_ID`
 * the endpoint behaves exactly as before this module existed - any signed-in
 * user passes - so an image can be rolled out ahead of the cluster config
 * change. It should not stay that way in production, hence the warning.
 */
export function logForwardAuthAuthzWarnings(
	config: { orgId: string | undefined },
	log: (message: string) => void = console.warn,
): void {
	if (config.orgId) return;
	log(
		"[ForwardAuth] FORWARD_AUTH_ORG_ID is not set: /api/verify authorizes every signed-in user. " +
			"Set it to the id of the organization whose members may reach protected apps.",
	);
}
