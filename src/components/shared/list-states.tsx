import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for lists - displays two placeholder rows.
 */
export function ListSkeleton() {
	return (
		<div className="space-y-3">
			<Skeleton className="h-12 w-full bg-zinc-800" />
			<Skeleton className="h-12 w-full bg-zinc-800" />
		</div>
	);
}

interface ListErrorProps {
	message: string;
}

/**
 * Error state for lists.
 */
export function ListError({ message }: ListErrorProps) {
	return (
		<div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
			{message}
		</div>
	);
}

interface EmptyStateProps {
	icon: LucideIcon;
	title: string;
	description?: string;
	/** Whether to use the larger "card" style (default: false) */
	variant?: "default" | "card";
}

/**
 * Empty state display for lists.
 */
export function EmptyState({
	icon: Icon,
	title,
	description,
	variant = "default",
}: EmptyStateProps) {
	if (variant === "card") {
		return (
			<div className="rounded-lg bg-zinc-800/50 border border-zinc-700 p-8 text-center">
				<Icon className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
				<p className="text-zinc-400 mb-2">{title}</p>
				{description && <p className="text-sm text-zinc-500">{description}</p>}
			</div>
		);
	}

	return (
		<div className="text-center py-6 text-zinc-500">
			<Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
			<p>{title}</p>
			{description && <p className="text-xs mt-1">{description}</p>}
		</div>
	);
}
