import { WarningCircleIcon } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import {
	emptyStateStyles,
	errorStyles,
	loadingStyles,
} from "@/lib/semantic-variants";
import { cn } from "@/lib/utils";

/**
 * Loading skeleton for lists - displays two placeholder rows.
 */
export function ListSkeleton() {
	return (
		<div className={loadingStyles.list}>
			<Skeleton className={loadingStyles.item} />
			<Skeleton className={loadingStyles.item} />
		</div>
	);
}

interface ListErrorProps {
	message: string;
	/** Optional retry action */
	retry?: () => void;
	className?: string;
}

/**
 * Error state for lists using semantic error styling.
 */
export function ListError({ message, retry, className }: ListErrorProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-2",
				errorStyles.container,
				className,
			)}
		>
			<WarningCircleIcon className={errorStyles.icon} />
			<span className="flex-1">{message}</span>
			{retry && (
				<button
					type="button"
					onClick={retry}
					className="text-xs underline underline-offset-2 hover:text-destructive/80"
				>
					Retry
				</button>
			)}
		</div>
	);
}

interface EmptyStateProps {
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	title: string;
	description?: string;
	/** Whether to use the larger "card" style (default: false) */
	variant?: "default" | "card";
}

/**
 * Empty state display for lists using semantic styling.
 */
export function EmptyState({
	icon: Icon,
	title,
	description,
	variant = "default",
}: EmptyStateProps) {
	if (variant === "card") {
		return (
			<div className={emptyStateStyles.card}>
				<Icon className={emptyStateStyles.icon.card} />
				<p className="mb-2 font-medium">{title}</p>
				{description && (
					<p className="text-sm text-muted-foreground">{description}</p>
				)}
			</div>
		);
	}

	return (
		<div className={emptyStateStyles.default}>
			<Icon className={emptyStateStyles.icon.default} />
			<p>{title}</p>
			{description && <p className="text-xs mt-1">{description}</p>}
		</div>
	);
}
