import { cn } from "@/lib/utils";

interface PageHeaderProps {
	title: string;
	description: string;
	action?: React.ReactNode;
	className?: string;
}

/**
 * Page header component with responsive layout.
 * On small screens, title/description and action wrap vertically.
 */
export function PageHeader({
	title,
	description,
	action,
	className,
}: PageHeaderProps) {
	return (
		<div
			className={cn(
				"flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
				className,
			)}
		>
			<div className="min-w-0 flex-1">
				<h1 className="text-2xl font-semibold text-foreground">{title}</h1>
				<p className="text-muted-foreground mt-1">{description}</p>
			</div>
			{action && <div className="shrink-0">{action}</div>}
		</div>
	);
}
