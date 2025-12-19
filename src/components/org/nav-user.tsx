import {
	CaretUpDownIcon,
	SignOutIcon,
	GearIcon,
	SunIcon,
	MoonIcon,
	DesktopIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { useSession } from "@/lib/auth-client";
import { useSignOut } from "@/hooks/use-sign-out";
import { useTheme, type UserTheme } from "@/lib/theme";

const themeOptions: { value: UserTheme; label: string; icon: typeof SunIcon }[] = [
	{ value: "light", label: "Light", icon: SunIcon },
	{ value: "dark", label: "Dark", icon: MoonIcon },
	{ value: "system", label: "System", icon: DesktopIcon },
];

export function NavUser() {
	const { isMobile } = useSidebar();
	const { data: session } = useSession();
	const handleSignOut = useSignOut();
	const { userTheme, setTheme } = useTheme();

	if (!session) return null;

	const user = session.user;
	const initials = user.name?.charAt(0).toUpperCase() || "U";

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar className="h-8 w-8 rounded-lg">
								{user.image && (
									<AvatarImage src={user.image} alt={user.name || "User"} />
								)}
								<AvatarFallback className="rounded-lg">
									{initials}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{user.name}</span>
								<span className="truncate text-xs">{user.email}</span>
							</div>
							<CaretUpDownIcon className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="h-8 w-8 rounded-lg">
									{user.image && (
										<AvatarImage src={user.image} alt={user.name || "User"} />
									)}
									<AvatarFallback className="rounded-lg">
										{initials}
									</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">{user.name}</span>
									<span className="truncate text-xs">{user.email}</span>
								</div>
							</div>
						</DropdownMenuLabel>
						
						<div className="px-2 py-1.5">
                            <ButtonGroup className="w-full">
								{themeOptions.map((option) => {
									const Icon = option.icon;
									const isActive = userTheme === option.value;
									return (
										<Button
											key={option.value}
											variant={isActive ? "default" : "outline"}
											size="icon-xs"
                                            className="flex-1"
											onClick={() => setTheme(option.value)}
											title={option.label}
										>
											<Icon className="size-3.5" />
										</Button>
									);
								})}
							</ButtonGroup>
						</div>
						<DropdownMenuSeparator />

                        <DropdownMenuGroup>
							<DropdownMenuItem asChild>
								<Link to="/settings">
									<GearIcon />
									Account Settings
								</Link>
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleSignOut}>
							<SignOutIcon />
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
