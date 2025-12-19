import { SpinnerIcon, TrashIcon } from "@phosphor-icons/react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DeleteConfirmDialogProps {
	title: string;
	description: React.ReactNode;
	onConfirm: () => void;
	isDeleting?: boolean;
	/** Action button text (default: "Delete") */
	confirmText?: string;
	/** Custom trigger element (default: trash icon button) */
	trigger?: React.ReactNode;
	/** Button size variant for default trigger (default: "sm") */
	buttonSize?: "sm" | "icon";
}

/**
 * Reusable delete confirmation dialog with consistent styling.
 * 
 * Features:
 * - Supports custom trigger or default trash icon button
 * - Disables and animates confirm action while pending
 * - Uses shadcn destructive variant for destructive actions
 * - Prevents double-submission during pending state
 */
export function DeleteConfirmDialog({
	title,
	description,
	onConfirm,
	isDeleting = false,
	confirmText = "Delete",
	trigger,
	buttonSize = "sm",
}: DeleteConfirmDialogProps) {
	const defaultTrigger = (
		<Button
			variant="ghost"
			size={buttonSize}
			disabled={isDeleting}
			className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
		>
			{isDeleting ? (
				<SpinnerIcon className="h-4 w-4 animate-spin" />
			) : (
				<TrashIcon className="h-4 w-4" />
			)}
		</Button>
	);

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild disabled={isDeleting}>
				{trigger ?? defaultTrigger}
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>
						{description}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDeleting}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						disabled={isDeleting}
						className={cn(
							"bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-opacity",
							isDeleting && "opacity-75 cursor-not-allowed"
						)}
					>
						{isDeleting ? (
							<>
								<SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
								{confirmText}
							</>
						) : (
							confirmText
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
