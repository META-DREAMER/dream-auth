/**
 * Semantic variant patterns for consistent UI styling across the app.
 * 
 * These patterns align with shadcn/ui component variants and CSS variable tokens.
 * Use these instead of ad-hoc Tailwind color classes.
 */

/**
 * Semantic button variants - use with Button component or buttonVariants
 * 
 * Standard variants: default, outline, secondary, ghost, destructive, link
 * 
 * For destructive actions, use variant="destructive" on Button component.
 */
export const buttonVariants = {
	destructive: "destructive", // Use Button variant="destructive"
	default: "default",
	outline: "outline",
	secondary: "secondary",
	ghost: "ghost",
	link: "link",
} as const;

/**
 * Semantic badge variants - use with Badge component
 * 
 * Standard variants: default, secondary, destructive, outline, ghost
 * 
 * For status/role badges, prefer outline variant with semantic color classes.
 */
export const badgeVariants = {
	default: "default",
	secondary: "secondary",
	destructive: "destructive",
	outline: "outline",
	ghost: "ghost",
} as const;

/**
 * Error state styling - consistent across ErrorAlert and ListError
 */
export const errorStyles = {
	container: "rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive",
	icon: "h-4 w-4 shrink-0",
} as const;

/**
 * Warning state styling - for non-critical alerts
 */
export const warningStyles = {
	container: "rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning-foreground",
	icon: "h-4 w-4 shrink-0",
} as const;

/**
 * Success state styling - for positive feedback
 */
export const successStyles = {
	container: "rounded-lg border border-success/20 bg-success/10 p-3 text-sm text-success-foreground",
	icon: "h-4 w-4 shrink-0",
} as const;

/**
 * Empty state styling - consistent spacing and muted colors
 */
export const emptyStateStyles = {
	default: "text-center py-6 text-muted-foreground",
	card: "rounded-lg bg-muted border p-8 text-center",
	icon: {
		default: "h-8 w-8 mx-auto mb-2 opacity-50",
		card: "h-12 w-12 mx-auto mb-4 text-muted-foreground",
	},
} as const;

/**
 * Loading skeleton styling - consistent spacing
 */
export const loadingStyles = {
	list: "space-y-3",
	item: "h-12 w-full",
} as const;

/**
 * Dialog icon container - consistent sizing and styling
 */
export const dialogIconStyles = {
	container: "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary",
	icon: "h-6 w-6 text-primary-foreground",
} as const;

