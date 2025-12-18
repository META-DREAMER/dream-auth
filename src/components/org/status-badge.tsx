import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
	pending: "bg-warning/20 text-warning-foreground border-warning/30",
	accepted: "bg-success/20 text-success-foreground border-success/30",
	rejected: "bg-destructive/20 text-destructive border-destructive/30",
	canceled: "bg-muted text-muted-foreground border-border",
	expired: "bg-muted text-muted-foreground border-border",
};

interface StatusBadgeProps {
	status: string;
	expired?: boolean;
}

/**
 * Status badge with semantic variants and proper expired state handling.
 */
export function StatusBadge({ status, expired = false }: StatusBadgeProps) {
	const displayStatus = expired && status === "pending" ? "expired" : status;
	const style = statusStyles[displayStatus] ?? statusStyles.pending;

	return (
		<Badge variant="outline" className={cn(style, "capitalize", expired && "line-through")}>
			{displayStatus}
		</Badge>
	);
}

