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
			<SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
				<SelectValue placeholder="Select a role" />
			</SelectTrigger>
			<SelectContent className="bg-zinc-900 border-zinc-800">
				<SelectItem
					value="member"
					className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
				>
					{showDescriptions ? (
						<div className="flex flex-col">
							<span>Member</span>
							<span className="text-xs text-zinc-500">
								Can view organization resources
							</span>
						</div>
					) : (
						"Member"
					)}
				</SelectItem>
				<SelectItem
					value="admin"
					className="text-zinc-300 focus:text-zinc-100 focus:bg-zinc-800"
				>
					{showDescriptions ? (
						<div className="flex flex-col">
							<span>Admin</span>
							<span className="text-xs text-zinc-500">
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

