import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface RoleSelectProps {
	value: string;
	onValueChange: (value: "member" | "admin") => void;
	showDescriptions?: boolean;
}

export function RoleSelect({
	value,
	onValueChange,
	showDescriptions = false,
}: RoleSelectProps) {
	return (
		<Select value={value} onValueChange={onValueChange}>
			<SelectTrigger>
				<SelectValue placeholder="Select a role" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="member">
					{showDescriptions ? (
						<div className="flex flex-col">
							<span>Member</span>
							<span className="text-xs text-muted-foreground">
								Can view organization resources
							</span>
						</div>
					) : (
						"Member"
					)}
				</SelectItem>
				<SelectItem value="admin">
					{showDescriptions ? (
						<div className="flex flex-col">
							<span>Admin</span>
							<span className="text-xs text-muted-foreground">
								Can manage members and invitations
							</span>
						</div>
					) : (
						"Admin"
					)}
				</SelectItem>
			</SelectContent>
		</Select>
	);
}

