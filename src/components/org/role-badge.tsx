import { Badge } from "@/components/ui/badge";

const roleStyles = {
	owner: "bg-violet-500/20 text-violet-400 border-violet-500/30",
	admin: "bg-blue-500/20 text-blue-400 border-blue-500/30",
	member: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

export function RoleBadge({ role }: { role: string }) {
	const style =
		roleStyles[role as keyof typeof roleStyles] ?? roleStyles.member;
	return (
		<Badge variant="outline" className={style}>
			{role}
		</Badge>
	);
}

