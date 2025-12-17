import { useQuery } from "@tanstack/react-query";
import { authClient, useSession } from "@/lib/auth-client";
import { orgMembersOptions } from "@/lib/org-queries";

export function useOrgPermissions() {
	const { data: activeOrg } = authClient.useActiveOrganization();
	const { data: session } = useSession();
	const { data: membersData } = useQuery(orgMembersOptions(activeOrg?.id));

	const members = membersData?.members ?? [];
	const currentMember = members.find((m) => m.userId === session?.user?.id);

	return {
		currentMember,
		isOwner: currentMember?.role === "owner",
		isAdmin: currentMember?.role === "admin",
		isOwnerOrAdmin:
			currentMember?.role === "owner" || currentMember?.role === "admin",
		isMember: !!currentMember,
	};
}

