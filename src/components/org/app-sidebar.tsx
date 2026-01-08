import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { OrgSwitcher } from "./org-switcher";
import { ThemeSwitcherButtons } from "./theme-switcher-buttons";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
	const { state } = useSidebar();
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<OrgSwitcher />
			</SidebarHeader>
			<SidebarContent>
				<NavMain />
			</SidebarContent>
			<SidebarFooter>
				<ThemeSwitcherButtons
					orientation={state === "collapsed" ? "vertical" : "horizontal"}
				/>
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
