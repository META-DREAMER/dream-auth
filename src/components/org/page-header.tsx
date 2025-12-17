interface PageHeaderProps {
	title: string;
	description: string;
	action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
	return (
		<div className="flex items-center justify-between">
			<div>
				<h1 className="text-2xl font-semibold text-zinc-100">{title}</h1>
				<p className="text-zinc-400">{description}</p>
			</div>
			{action}
		</div>
	);
}

