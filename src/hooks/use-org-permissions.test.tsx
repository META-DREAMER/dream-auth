/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted ensures these mocks are available when vi.mock factory runs
// (vi.mock calls are hoisted to top of file, before variable declarations)
const { mockUseActiveOrganization, mockUseSession, mockOrgMembersOptions } =
	vi.hoisted(() => ({
		mockUseActiveOrganization: vi.fn(),
		mockUseSession: vi.fn(),
		mockOrgMembersOptions: vi.fn(),
	}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useActiveOrganization: mockUseActiveOrganization,
	},
	useSession: mockUseSession,
}));

vi.mock("@/lib/org-queries", () => ({
	orgMembersOptions: mockOrgMembersOptions,
}));

import {
	createMockOrganization,
	createMockSession,
	createUseActiveOrganizationReturn,
	createUseSessionReturn,
} from "@test/mocks/auth-client";
import {
	createDisabledOrgMembersOptions,
	createOrgMembersOptions,
} from "@test/mocks/org-query";
import { useOrgPermissions } from "./use-org-permissions";

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
		},
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

describe("useOrgPermissions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns isOwner true when user has owner role", async () => {
		mockUseActiveOrganization.mockReturnValue(
			createUseActiveOrganizationReturn(
				createMockOrganization({ id: "org-1", name: "Test Org" }),
			),
		);
		mockUseSession.mockReturnValue(
			createUseSessionReturn(createMockSession({ user: { id: "user-1" } })),
		);
		mockOrgMembersOptions.mockReturnValue(
			createOrgMembersOptions("org-1", [{ userId: "user-1", role: "owner" }]),
		);

		const { result } = renderHook(() => useOrgPermissions(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.isOwner).toBe(true);
		});
		expect(result.current.isAdmin).toBe(false);
		expect(result.current.isOwnerOrAdmin).toBe(true);
		expect(result.current.isMember).toBe(true);
	});

	it("returns isAdmin true when user has admin role", async () => {
		mockUseActiveOrganization.mockReturnValue(
			createUseActiveOrganizationReturn(
				createMockOrganization({ id: "org-1", name: "Test Org" }),
			),
		);
		mockUseSession.mockReturnValue(
			createUseSessionReturn(createMockSession({ user: { id: "user-1" } })),
		);
		mockOrgMembersOptions.mockReturnValue(
			createOrgMembersOptions("org-1", [{ userId: "user-1", role: "admin" }]),
		);

		const { result } = renderHook(() => useOrgPermissions(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.isAdmin).toBe(true);
		});
		expect(result.current.isOwner).toBe(false);
		expect(result.current.isOwnerOrAdmin).toBe(true);
		expect(result.current.isMember).toBe(true);
	});

	it("returns isMember true when user has member role", async () => {
		mockUseActiveOrganization.mockReturnValue(
			createUseActiveOrganizationReturn(
				createMockOrganization({ id: "org-1", name: "Test Org" }),
			),
		);
		mockUseSession.mockReturnValue(
			createUseSessionReturn(createMockSession({ user: { id: "user-1" } })),
		);
		mockOrgMembersOptions.mockReturnValue(
			createOrgMembersOptions("org-1", [{ userId: "user-1", role: "member" }]),
		);

		const { result } = renderHook(() => useOrgPermissions(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.isMember).toBe(true);
		});
		expect(result.current.isOwner).toBe(false);
		expect(result.current.isAdmin).toBe(false);
		expect(result.current.isOwnerOrAdmin).toBe(false);
	});

	it("returns all false when no active organization", async () => {
		mockUseActiveOrganization.mockReturnValue(
			createUseActiveOrganizationReturn(undefined),
		);
		mockUseSession.mockReturnValue(
			createUseSessionReturn(createMockSession({ user: { id: "user-1" } })),
		);
		mockOrgMembersOptions.mockReturnValue(createDisabledOrgMembersOptions());

		const { result } = renderHook(() => useOrgPermissions(), {
			wrapper: createWrapper(),
		});

		expect(result.current.isMember).toBe(false);
		expect(result.current.isOwner).toBe(false);
		expect(result.current.isAdmin).toBe(false);
		expect(result.current.isOwnerOrAdmin).toBe(false);
		expect(result.current.currentMember).toBeUndefined();
	});

	it("returns all false when user not found in members", async () => {
		mockUseActiveOrganization.mockReturnValue(
			createUseActiveOrganizationReturn(
				createMockOrganization({ id: "org-1", name: "Test Org" }),
			),
		);
		mockUseSession.mockReturnValue(
			createUseSessionReturn(createMockSession({ user: { id: "user-1" } })),
		);
		mockOrgMembersOptions.mockReturnValue(
			createOrgMembersOptions("org-1", [
				{ userId: "different-user", role: "member" },
			]),
		);

		const { result } = renderHook(() => useOrgPermissions(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.isMember).toBe(false);
		});
		expect(result.current.currentMember).toBeUndefined();
	});

	it("finds currentMember from members list", async () => {
		mockUseActiveOrganization.mockReturnValue(
			createUseActiveOrganizationReturn(
				createMockOrganization({ id: "org-1", name: "Test Org" }),
			),
		);
		mockUseSession.mockReturnValue(
			createUseSessionReturn(createMockSession({ user: { id: "user-1" } })),
		);
		mockOrgMembersOptions.mockReturnValue(
			createOrgMembersOptions("org-1", [
				{ userId: "other-user", role: "member" },
				{ userId: "user-1", role: "admin" },
			]),
		);

		const { result } = renderHook(() => useOrgPermissions(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.currentMember).toBeDefined();
			expect(result.current.currentMember?.userId).toBe("user-1");
			expect(result.current.currentMember?.role).toBe("admin");
		});
	});
});
