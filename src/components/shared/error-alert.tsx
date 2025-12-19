import { WarningCircleIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { errorStyles } from "@/lib/semantic-variants";

interface ErrorAlertProps {
	message: string;
	className?: string;
}

/**
 * Standardized error display component using semantic error styling.
 */
export function ErrorAlert({ message, className }: ErrorAlertProps) {
	return (
		<div className={cn("flex items-center gap-2", errorStyles.container, className)}>
			<WarningCircleIcon className={errorStyles.icon} />
			<span>{message}</span>
		</div>
	);
}
