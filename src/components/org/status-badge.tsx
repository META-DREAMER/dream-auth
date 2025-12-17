import { Badge } from "@/components/ui/badge";

const statusStyles: Record<string, string> = {
	pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
	accepted: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
	rejected: "bg-red-500/20 text-red-400 border-red-500/30",
	canceled: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

interface StatusBadgeProps {
	status: string;
	expired?: boolean;
}

export function StatusBadge({ status, expired = false }: StatusBadgeProps) {
	const displayStatus = expired && status === "pending" ? "expired" : status;
	const style = statusStyles[status] ?? statusStyles.pending;

	return (
		<Badge variant="outline" className={style}>
			{displayStatus}
		</Badge>
	);
}

