/**
 * Type-safe mock factories for BetterAuth client hooks.
 *
 * These factories produce objects compatible with what vi.mocked() expects.
 * We intentionally avoid explicit return type annotations to let TypeScript
 * infer types that are compatible with the mocked function signatures.
 */

/**
 * Creates a mock user with required fields.
 */
export function createMockUser(
	overrides: {
		id?: string;
		email?: string;
		name?: string;
		image?: string | null;
		emailVerified?: boolean;
		createdAt?: Date;
		updatedAt?: Date;
	} = {},
) {
	return {
		id: overrides.id ?? "user-1",
		email: overrides.email ?? "test@example.com",
		name: overrides.name ?? "Test User",
		image: overrides.image ?? null,
		emailVerified: overrides.emailVerified ?? true,
		createdAt: overrides.createdAt ?? new Date("2024-01-01"),
		updatedAt: overrides.updatedAt ?? new Date("2024-01-01"),
	};
}

/**
 * Creates a mock session with user and session data.
 */
export function createMockSession(
	overrides: {
		user?: Parameters<typeof createMockUser>[0];
		session?: {
			id?: string;
			userId?: string;
			token?: string;
			expiresAt?: Date;
			createdAt?: Date;
			updatedAt?: Date;
			ipAddress?: string;
			userAgent?: string;
		};
	} = {},
) {
	const user = createMockUser(overrides.user);
	return {
		user,
		session: {
			id: overrides.session?.id ?? "session-1",
			userId: user.id,
			token: overrides.session?.token ?? "mock-token",
			expiresAt:
				overrides.session?.expiresAt ?? new Date(Date.now() + 86400000),
			createdAt: overrides.session?.createdAt ?? new Date(),
			updatedAt: overrides.session?.updatedAt ?? new Date(),
			ipAddress: overrides.session?.ipAddress,
			userAgent: overrides.session?.userAgent,
		},
	};
}

/**
 * Creates a mock useSession return value (authenticated).
 */
export function createUseSessionReturn(
	session: ReturnType<typeof createMockSession>,
) {
	return {
		data: session,
		isPending: false,
		isRefetching: false,
		error: null,
		refetch: async () => {},
	};
}

/**
 * Creates a mock useSession return value (unauthenticated).
 */
export function createUseSessionReturnNull() {
	return {
		data: null,
		isPending: false,
		isRefetching: false,
		error: null,
		refetch: async () => {},
	};
}

/**
 * Creates a mock useSession return value (loading).
 */
export function createUseSessionReturnPending() {
	return {
		data: null,
		isPending: true,
		isRefetching: false,
		error: null,
		refetch: async () => {},
	};
}

/**
 * Creates a mock organization with full structure including members and invitations.
 * BetterAuth's useActiveOrganization returns an organization with these nested arrays.
 */
export function createMockOrganization(
	overrides: {
		id?: string;
		name?: string;
		slug?: string;
		logo?: string | null;
		createdAt?: Date;
		metadata?: Record<string, unknown>;
		members?: Array<{
			id: string;
			organizationId: string;
			role: "owner" | "admin" | "member";
			createdAt: Date;
			userId: string;
			teamId?: string;
			user: {
				id: string;
				email: string;
				name: string;
				image: string | null | undefined;
			};
		}>;
		invitations?: Array<{
			id: string;
			organizationId: string;
			email: string;
			role: "owner" | "admin" | "member";
			status: "pending" | "accepted" | "rejected" | "canceled";
			expiresAt: Date;
			inviterId: string;
		}>;
	} = {},
) {
	return {
		id: overrides.id ?? "org-1",
		name: overrides.name ?? "Test Organization",
		slug: overrides.slug ?? "test-org",
		logo: overrides.logo ?? null,
		createdAt: overrides.createdAt ?? new Date("2024-01-01"),
		metadata: overrides.metadata,
		// BetterAuth includes members and invitations in the active organization
		members: overrides.members ?? [],
		invitations: overrides.invitations ?? [],
	};
}

/**
 * Creates a mock useActiveOrganization return value.
 */
export function createUseActiveOrganizationReturn(
	org: ReturnType<typeof createMockOrganization> | undefined,
) {
	return {
		data: org,
		isPending: false,
		isRefetching: false,
		error: null,
		refetch: async () => {},
	};
}
