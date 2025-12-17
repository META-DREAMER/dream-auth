import { Loader2, Trash2 } from "lucide-react";
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

interface DeleteConfirmDialogProps {
	title: string;
	description: React.ReactNode;
	onConfirm: () => void;
	isDeleting?: boolean;
	/** Action button text (default: "Delete") */
	confirmText?: string;
	/** Button size variant */
	buttonSize?: "sm" | "icon";
}

/**
 * Reusable delete confirmation dialog with consistent styling.
 */
export function DeleteConfirmDialog({
	title,
	description,
	onConfirm,
	isDeleting,
	confirmText = "Delete",
	buttonSize = "sm",
}: DeleteConfirmDialogProps) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button
					variant="ghost"
					size={buttonSize}
					disabled={isDeleting}
					className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
				>
					{isDeleting ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Trash2 className="h-4 w-4" />
					)}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>
						{description}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{confirmText}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
