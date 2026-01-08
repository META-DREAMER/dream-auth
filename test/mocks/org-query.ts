/**
 * Type-safe mock factories for organization query options.
 *
 * These factories produce objects compatible with what vi.mocked() expects
 * for orgMembersOptions and related query option functions.
 */

/**
 * Creates a mock organization member matching BetterAuth's organization plugin types.
 * The `user.image` field is required (can be null) per BetterAuth's type definition.
 */
export function createMockOrgMember(overrides: {
	userId: string;
	role: "owner" | "admin" | "member";
	id?: string;
	organizationId?: string;
	createdAt?: Date;
	teamId?: string;
	user?: {
		id: string;
		email: string;
		name: string;
		image: string | null | undefined;
	};
}) {
	return {
		id: overrides.id ?? `member-${overrides.userId}`,
		organizationId: overrides.organizationId ?? "org-1",
		userId: overrides.userId,
		role: overrides.role,
		createdAt: overrides.createdAt ?? new Date("2024-01-01"),
		teamId: overrides.teamId,
		user: overrides.user ?? {
			id: overrides.userId,
			email: `${overrides.userId}@example.com`,
			name: `User ${overrides.userId}`,
			image: null, // Required field per BetterAuth types
		},
	};
}

/**
 * Creates a mock for orgMembersOptions that returns proper query options.
 */
export function createOrgMembersOptions(
	orgId: string | undefined,
	members: Array<{
		userId: string;
		role: "owner" | "admin" | "member";
	}>,
) {
	const fullMembers = members.map((m) => createMockOrgMember(m));

	return {
		queryKey: ["organization", orgId, "members"] as [
			string,
			string | undefined,
			string,
		],
		queryFn: async () => ({
			members: fullMembers,
			total: fullMembers.length,
		}),
		enabled: !!orgId,
	};
}

/**
 * Creates a mock for disabled org members query (no org selected).
 */
export function createDisabledOrgMembersOptions() {
	return {
		queryKey: ["organization", undefined, "members"] as [
			string,
			undefined,
			string,
		],
		queryFn: async () => null,
		enabled: false,
	};
}

/**
 * Creates a mock organization invitation.
 */
export function createMockOrgInvitation(overrides: {
	email: string;
	id?: string;
	organizationId?: string;
	role?: "owner" | "admin" | "member";
	status?: "pending" | "accepted" | "rejected" | "canceled";
	expiresAt?: Date;
	inviterId?: string;
	walletAddress?: string;
}) {
	return {
		id: overrides.id ?? `invite-${Date.now()}`,
		organizationId: overrides.organizationId ?? "org-1",
		email: overrides.email,
		role: overrides.role ?? "member",
		status: overrides.status ?? "pending",
		expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 86400000),
		inviterId: overrides.inviterId ?? "user-1",
		walletAddress: overrides.walletAddress,
	};
}
