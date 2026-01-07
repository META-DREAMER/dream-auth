import {
	BuildingIcon,
	GearIcon,
	UsersIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import { Link, useLocation } from "@tanstack/react-router";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
	{ href: "/org", label: "Overview", icon: BuildingIcon },
	{ href: "/org/members", label: "Members", icon: UsersIcon },
	{ href: "/org/teams", label: "Teams", icon: UsersThreeIcon },
	{ href: "/org/settings", label: "Settings", icon: GearIcon },
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
								<SidebarMenuButton
									asChild
									isActive={isActive}
									tooltip={item.label}
								>
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
