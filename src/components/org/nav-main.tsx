import { Link, useLocation } from "@tanstack/react-router";
import { Building2, Users, UsersRound, Mail, Settings } from "lucide-react";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
	{ href: "/org", label: "Overview", icon: Building2 },
	{ href: "/org/members", label: "Members", icon: Users },
	{ href: "/org/teams", label: "Teams", icon: UsersRound },
	{ href: "/org/invitations", label: "Invitations", icon: Mail },
	{ href: "/org/settings", label: "Settings", icon: Settings },
];

export function NavMain() {
	const location = useLocation();

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Organization</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{navItems.map((item) => {
						// For overview, only active on exact match
						// For others, active if pathname starts with href
						const isActive =
							item.href === "/org"
								? location.pathname === "/org" || location.pathname === "/org/"
								: location.pathname.startsWith(item.href);

						return (
							<SidebarMenuItem key={item.href}>
								<SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
									<Link to={item.href}>
										<item.icon />
										<span>{item.label}</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
