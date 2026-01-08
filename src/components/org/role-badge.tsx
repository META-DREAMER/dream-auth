import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const roleStyles = {
	owner:
		"bg-violet-500/20 text-violet-400 border-violet-500/30 dark:bg-violet-500/30 dark:text-violet-300",
	admin:
		"bg-blue-500/20 text-blue-400 border-blue-500/30 dark:bg-blue-500/30 dark:text-blue-300",
	member: "bg-muted text-muted-foreground border-border",
};

/**
 * Role badge with semantic variants for owner, admin, and member roles.
 */
export function RoleBadge({ role }: { role: string }) {
	const style =
		roleStyles[role as keyof typeof roleStyles] ?? roleStyles.member;
	return (
		<Badge variant="outline" className={cn(style, "capitalize")}>
			{role}
		</Badge>
	);
}
