import { AlertCircle } from "lucide-react";

interface ErrorAlertProps {
	message: string;
	className?: string;
}

/**
 * Standardized error display component.
 */
export function ErrorAlert({ message, className }: ErrorAlertProps) {
	return (
		<div
			className={`flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 ${className ?? ""}`}
		>
			<AlertCircle className="h-4 w-4 shrink-0" />
			<span>{message}</span>
		</div>
	);
}
