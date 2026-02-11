import { useQuery } from "@tanstack/react-query";
import { authClient, organization } from "@/lib/auth-client";

export function useOrgPermissions() {
	const { data: activeOrg } = authClient.useActiveOrganization();

	const { data: activeMember } = useQuery({
		queryKey: ["organization", activeOrg?.id, "activeMemberRole"],
		queryFn: async () => {
			const result = await organization.getActiveMemberRole({});
			return result.data ?? null;
		},
		enabled: !!activeOrg?.id,
		staleTime: 1000 * 60 * 5,
	});

	const role = activeMember?.role;

	return {
		role,
		isOwner: role === "owner",
		isAdmin: role === "admin",
		isOwnerOrAdmin: role === "owner" || role === "admin",
		isMember: !!role,
	};
}
