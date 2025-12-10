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
					className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
				>
					{isDeleting ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Trash2 className="h-4 w-4" />
					)}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent className="bg-zinc-900 border-zinc-800">
				<AlertDialogHeader>
					<AlertDialogTitle className="text-zinc-100">{title}</AlertDialogTitle>
					<AlertDialogDescription className="text-zinc-400">
						{description}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className="bg-red-500 text-white hover:bg-red-600"
					>
						{confirmText}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
