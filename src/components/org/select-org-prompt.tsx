import { BuildingIcon } from "@phosphor-icons/react";

export function SelectOrgPrompt() {
	return (
		<div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
			<div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
				<BuildingIcon className="h-8 w-8 text-muted-foreground" />
			</div>
			<h2 className="text-2xl font-semibold text-foreground">
				Select an organization to get started
			</h2>
			<p className="text-muted-foreground max-w-md">
				Use the organization switcher in the sidebar to select an organization
				or create a new one.
			</p>
		</div>
	);
}

