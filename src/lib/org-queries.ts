import { queryOptions } from "@tanstack/react-query";
import { organization } from "@/lib/auth-client";

/** 5 minutes - org data changes infrequently */
const ORG_STALE_TIME = 1000 * 60 * 5;

export const orgMembersOptions = (orgId: string | undefined) =>
	queryOptions({
		queryKey: ["organization", orgId, "members"],
		queryFn: async () => {
			if (!orgId) return null;
			const result = await organization.listMembers();
			return result.data ?? null;
		},
		enabled: !!orgId,
		staleTime: ORG_STALE_TIME,
	});

export const orgInvitationsOptions = (orgId: string | undefined) =>
	queryOptions({
		queryKey: ["organization", orgId, "invitations"],
		queryFn: async () => {
			if (!orgId) return null;
			const result = await organization.listInvitations();
			return result.data ?? null;
		},
		enabled: !!orgId,
		staleTime: ORG_STALE_TIME,
	});

export const orgFullOptions = (orgId: string | undefined) =>
	queryOptions({
		queryKey: ["organization", orgId, "full"],
		queryFn: async () => {
			if (!orgId) return null;
			const result = await organization.getFullOrganization();
			return result.data ?? null;
		},
		enabled: !!orgId,
		staleTime: ORG_STALE_TIME,
	});

export const orgTeamsOptions = (orgId: string | undefined) =>
	queryOptions({
		queryKey: ["organization", orgId, "teams"],
		queryFn: async () => {
			if (!orgId) return null;
			const result = await organization.listTeams();
			return result.data ?? null;
		},
		enabled: !!orgId,
		staleTime: ORG_STALE_TIME,
	});
