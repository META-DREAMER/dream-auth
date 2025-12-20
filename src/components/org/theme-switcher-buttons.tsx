import { SunIcon, MoonIcon, DesktopIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { useTheme, type UserTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const themeOptions: { value: UserTheme; label: string; icon: typeof SunIcon }[] = [
	{ value: "light", label: "Light", icon: SunIcon },
	{ value: "dark", label: "Dark", icon: MoonIcon },
	{ value: "system", label: "System", icon: DesktopIcon },
];

export function ThemeSwitcherButtons({ orientation }: { orientation?: React.ComponentProps<typeof ButtonGroup>["orientation"] }) {
	const { userTheme, setTheme } = useTheme();

	return (
		<div className={cn("px-2 py-1.5 ", orientation === "vertical" ? "flex flex-col items-center" : "")}>
			<ButtonGroup orientation={orientation}>
				{themeOptions.map((option) => {
					const Icon = option.icon;
					const isActive = userTheme === option.value;
					return (
						<Button
							key={option.value}
							variant="outline"
							size="icon-xs"
							className=" py-1 text-muted-foreground bg-muted data-[active=true]:bg-card data-[active=true]:text-card-foreground flex-1"
							data-active={isActive}
							onClick={() => setTheme(option.value)}
							title={option.label}
						>
							<Icon className="size-3.5" />
						</Button>
					);
				})}
			</ButtonGroup>
		</div>
	);
}

