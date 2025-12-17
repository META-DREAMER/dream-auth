/**
 * Gradient background decoration used across pages.
 * Renders decorative blurred circles in the corners.
 */
export function PageBackground() {
	return (
		<div className="absolute inset-0 overflow-hidden pointer-events-none">
			<div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
			<div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/20 rounded-full blur-3xl" />
		</div>
	);
}
