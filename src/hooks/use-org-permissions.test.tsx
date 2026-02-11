/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const noOrgReturn = {
	data: undefined as unknown,
	isPending: false,
	error: null,
};

// vi.hoisted ensures these mocks are available when vi.mock factory runs
const { mockUseActiveOrganization, mockGetActiveMemberRole } = vi.hoisted(
	() => ({
		mockUseActiveOrganization: vi.fn(
			(): { data: unknown; isPending: boolean; error: null } => ({
				data: undefined,
				isPending: false,
				error: null,
			}),
		),
		mockGetActiveMemberRole: vi.fn(),
	}),
);

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useActiveOrganization: mockUseActiveOrganization,
	},
	organization: {
		getActiveMemberRole: mockGetActiveMemberRole,
	},
}));

import {
	createMockOrganization,
	createUseActiveOrganizationReturn,
} from "@test/mocks/auth-client";
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
	afterEach(() => {
		// Unmount React components before clearing mocks to prevent
		// re-renders with undefined mock return values
		cleanup();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		mockUseActiveOrganization.mockReturnValue(noOrgReturn);
	});

	it("returns isOwner true when user has owner role", async () => {
		mockUseActiveOrganization.mockReturnValue(
			createUseActiveOrganizationReturn(
				createMockOrganization({ id: "org-1", name: "Test Org" }),
			),
		);
		mockGetActiveMemberRole.mockResolvedValue({
			data: { role: "owner" },
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
		mockUseActiveOrganization.mockReturnValue(
			createUseActiveOrganizationReturn(
				createMockOrganization({ id: "org-1", name: "Test Org" }),
			),
		);
		mockGetActiveMemberRole.mockResolvedValue({
			data: { role: "admin" },
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
		mockUseActiveOrganization.mockReturnValue(
			createUseActiveOrganizationReturn(
				createMockOrganization({ id: "org-1", name: "Test Org" }),
			),
		);
		mockGetActiveMemberRole.mockResolvedValue({
			data: { role: "member" },
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
		mockUseActiveOrganization.mockReturnValue(
			createUseActiveOrganizationReturn(undefined),
		);

		const { result } = renderHook(() => useOrgPermissions(), {
			wrapper: createWrapper(),
		});

		expect(result.current.isMember).toBe(false);
		expect(result.current.isOwner).toBe(false);
		expect(result.current.isAdmin).toBe(false);
		expect(result.current.isOwnerOrAdmin).toBe(false);
		expect(result.current.role).toBeUndefined();
	});

	it("returns all false when getActiveMemberRole returns null", async () => {
		mockUseActiveOrganization.mockReturnValue(
			createUseActiveOrganizationReturn(
				createMockOrganization({ id: "org-1", name: "Test Org" }),
			),
		);
		mockGetActiveMemberRole.mockResolvedValue({ data: null });

		const { result } = renderHook(() => useOrgPermissions(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.isMember).toBe(false);
		});
		expect(result.current.role).toBeUndefined();
	});
});
