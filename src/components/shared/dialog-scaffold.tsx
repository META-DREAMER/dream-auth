import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { dialogIconStyles } from "@/lib/semantic-variants";

interface DialogHeaderScaffoldProps {
	/** Icon to display in header */
	icon: LucideIcon;
	/** Dialog title */
	title: string;
	/** Dialog description */
	description: string | ReactNode;
	/** Additional className for DialogHeader */
	className?: string;
}

/**
 * Shared dialog header scaffold providing consistent icon sizing, spacing, and layout.
 * 
 * Features:
 * - Consistent header icon (h-12 w-12 rounded-full bg-primary)
 * - Centered title and description
 * - Consistent spacing
 * 
 * Use this within DialogContent to standardize dialog headers across the app.
 */
export function DialogHeaderScaffold({
	icon: Icon,
	title,
	description,
	className,
}: DialogHeaderScaffoldProps) {
	return (
		<DialogHeader className={className}>
			<div className={dialogIconStyles.container}>
				<Icon className={dialogIconStyles.icon} />
			</div>
			<DialogTitle className="text-center">{title}</DialogTitle>
			<DialogDescription className="text-center">
				{description}
			</DialogDescription>
		</DialogHeader>
	);
}

