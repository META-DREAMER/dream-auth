/**
 * Gradient background decoration used across pages.
 * Uses fixed positioning to cover the entire viewport regardless of scroll.
 */
export function PageBackground() {
	return (
		<div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
			{/* Top right glow */}
			<div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
			{/* Bottom left glow */}
			<div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
			{/* Center subtle accent */}
			<div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-3xl" />
		</div>
	);
}
