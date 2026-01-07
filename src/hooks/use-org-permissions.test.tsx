/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth-client before importing the hook
vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useActiveOrganization: vi.fn(),
	},
	useSession: vi.fn(),
}));

// Mock org-queries
vi.mock("@/lib/org-queries", () => ({
	orgMembersOptions: vi.fn((orgId: string | undefined) => ({
		queryKey: ["org-members", orgId],
		queryFn: async () => ({ members: [] }),
		enabled: !!orgId,
	})),
}));

import { authClient, useSession } from "@/lib/auth-client";
import { orgMembersOptions } from "@/lib/org-queries";
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
		vi.mocked(authClient.useActiveOrganization).mockReturnValue({
			data: { id: "org-1", name: "Test Org" },
		} as ReturnType<typeof authClient.useActiveOrganization>);
		vi.mocked(useSession).mockReturnValue({
			data: { user: { id: "user-1" } },
		} as ReturnType<typeof useSession>);
		vi.mocked(orgMembersOptions).mockReturnValue({
			queryKey: ["org-members", "org-1"],
			queryFn: async () => ({
				members: [{ userId: "user-1", role: "owner" }],
			}),
			enabled: true,
		});

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
		vi.mocked(authClient.useActiveOrganization).mockReturnValue({
			data: { id: "org-1", name: "Test Org" },
		} as ReturnType<typeof authClient.useActiveOrganization>);
		vi.mocked(useSession).mockReturnValue({
			data: { user: { id: "user-1" } },
		} as ReturnType<typeof useSession>);
		vi.mocked(orgMembersOptions).mockReturnValue({
			queryKey: ["org-members", "org-1"],
			queryFn: async () => ({
				members: [{ userId: "user-1", role: "admin" }],
			}),
			enabled: true,
		});

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
		vi.mocked(authClient.useActiveOrganization).mockReturnValue({
			data: { id: "org-1", name: "Test Org" },
		} as ReturnType<typeof authClient.useActiveOrganization>);
		vi.mocked(useSession).mockReturnValue({
			data: { user: { id: "user-1" } },
		} as ReturnType<typeof useSession>);
		vi.mocked(orgMembersOptions).mockReturnValue({
			queryKey: ["org-members", "org-1"],
			queryFn: async () => ({
				members: [{ userId: "user-1", role: "member" }],
			}),
			enabled: true,
		});

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
		vi.mocked(authClient.useActiveOrganization).mockReturnValue({
			data: undefined,
		} as ReturnType<typeof authClient.useActiveOrganization>);
		vi.mocked(useSession).mockReturnValue({
			data: { user: { id: "user-1" } },
		} as ReturnType<typeof useSession>);
		vi.mocked(orgMembersOptions).mockReturnValue({
			queryKey: ["org-members", undefined],
			queryFn: async () => ({ members: [] }),
			enabled: false,
		});

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
		vi.mocked(authClient.useActiveOrganization).mockReturnValue({
			data: { id: "org-1", name: "Test Org" },
		} as ReturnType<typeof authClient.useActiveOrganization>);
		vi.mocked(useSession).mockReturnValue({
			data: { user: { id: "user-1" } },
		} as ReturnType<typeof useSession>);
		vi.mocked(orgMembersOptions).mockReturnValue({
			queryKey: ["org-members", "org-1"],
			queryFn: async () => ({
				members: [{ userId: "different-user", role: "member" }],
			}),
			enabled: true,
		});

		const { result } = renderHook(() => useOrgPermissions(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.isMember).toBe(false);
		});
		expect(result.current.currentMember).toBeUndefined();
	});

	it("finds currentMember from members list", async () => {
		const expectedMember = {
			userId: "user-1",
			role: "admin",
			name: "Test User",
		};
		vi.mocked(authClient.useActiveOrganization).mockReturnValue({
			data: { id: "org-1", name: "Test Org" },
		} as ReturnType<typeof authClient.useActiveOrganization>);
		vi.mocked(useSession).mockReturnValue({
			data: { user: { id: "user-1" } },
		} as ReturnType<typeof useSession>);
		vi.mocked(orgMembersOptions).mockReturnValue({
			queryKey: ["org-members", "org-1"],
			queryFn: async () => ({
				members: [{ userId: "other-user", role: "member" }, expectedMember],
			}),
			enabled: true,
		});

		const { result } = renderHook(() => useOrgPermissions(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.currentMember).toEqual(expectedMember);
		});
	});
});
