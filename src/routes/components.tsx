import {
	ArrowRightIcon,
	BluetoothIcon,
	CheckIcon,
	CopyIcon,
	CreditCardIcon,
	DotsThreeVerticalIcon,
	EyeIcon,
	GearIcon,
	InfoIcon,
	MonitorIcon,
	MoonIcon,
	PaletteIcon,
	PencilIcon,
	PlusIcon,
	SignOutIcon,
	SunIcon,
	TrashIcon,
	UserIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/components")({
	component: ComponentShowcase,
});

function ExampleWrapper({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div className="bg-background min-h-screen w-full">
			<div className="border-b bg-card/50 px-6 py-4">
				<h1 className="text-2xl font-semibold">Component Showcase</h1>
				<p className="text-muted-foreground text-sm">
					Visual overview of all shadcn/ui components with radix-nova style
				</p>
			</div>
			<div
				data-slot="example-wrapper"
				className={cn(
					"mx-auto grid w-full max-w-7xl min-w-0 content-start items-start gap-8 p-6 md:grid-cols-2 xl:grid-cols-3",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

function Example({
	title,
	children,
	className,
	containerClassName,
	...props
}: React.ComponentProps<"div"> & {
	title: string;
	containerClassName?: string;
}) {
	return (
		<div
			data-slot="example"
			className={cn(
				"flex w-full min-w-0 flex-col gap-1 self-stretch",
				containerClassName,
			)}
			{...props}
		>
			<div className="text-muted-foreground px-1.5 py-2 text-xs font-medium uppercase tracking-wider">
				{title}
			</div>
			<div
				data-slot="example-content"
				className={cn(
					"bg-card ring-foreground/10 flex min-w-0 flex-1 flex-col items-start gap-4 rounded-xl p-4 ring-1",
					className,
				)}
			>
				{children}
			</div>
		</div>
	);
}

function ComponentShowcase() {
	return (
		<ExampleWrapper>
			<ButtonExamples />
			<BadgeExamples />
			<CardExample />
			<InputExamples />
			<SelectExample />
			<CheckboxExample />
			<DialogExample />
			<AlertDialogExample />
			<DropdownMenuExample />
			<TabsExample />
			<TableExample />
			<AvatarExample />
			<TooltipExample />
			<OTPExample />
			<SkeletonExample />
			<SeparatorExample />
		</ExampleWrapper>
	);
}

function ButtonExamples() {
	return (
		<Example title="Buttons">
			<div className="flex flex-wrap items-center gap-2">
				<Button>Default</Button>
				<Button variant="secondary">Secondary</Button>
				<Button variant="outline">Outline</Button>
				<Button variant="ghost">Ghost</Button>
				<Button variant="destructive">Destructive</Button>
				<Button variant="link">Link</Button>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Button size="xs">Extra Small</Button>
				<Button size="sm">Small</Button>
				<Button size="default">Default</Button>
				<Button size="lg">Large</Button>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Button size="icon-xs">
					<PlusIcon />
				</Button>
				<Button size="icon-sm">
					<PlusIcon />
				</Button>
				<Button size="icon">
					<PlusIcon />
				</Button>
				<Button size="icon-lg">
					<PlusIcon />
				</Button>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Button>
					<PlusIcon data-icon="inline-start" />
					With Icon
				</Button>
				<Button variant="outline">
					Continue
					<ArrowRightIcon data-icon="inline-end" />
				</Button>
				<Button disabled>Disabled</Button>
			</div>
		</Example>
	);
}

function BadgeExamples() {
	return (
		<Example title="Badges">
			<div className="flex flex-wrap items-center gap-2">
				<Badge>Default</Badge>
				<Badge variant="secondary">Secondary</Badge>
				<Badge variant="outline">Outline</Badge>
				<Badge variant="destructive">Destructive</Badge>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Badge>
					<CheckIcon /> Success
				</Badge>
				<Badge variant="destructive">
					<WarningIcon /> Error
				</Badge>
				<Badge variant="secondary">
					<InfoIcon /> Info
				</Badge>
			</div>
		</Example>
	);
}

function CardExample() {
	return (
		<Example title="Card" className="items-center justify-center">
			<Card className="w-full">
				<CardHeader>
					<CardTitle>Card Title</CardTitle>
					<CardDescription>
						This is a description of the card content.
					</CardDescription>
					<CardAction>
						<Button variant="ghost" size="icon-sm">
							<DotsThreeVerticalIcon />
						</Button>
					</CardAction>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						Card content goes here. You can put any content inside a card.
					</p>
				</CardContent>
				<CardFooter>
					<Button variant="outline" size="sm">
						Cancel
					</Button>
					<Button size="sm" className="ml-auto">
						Save
					</Button>
				</CardFooter>
			</Card>
		</Example>
	);
}

function InputExamples() {
	return (
		<Example title="Inputs">
			<div className="grid w-full gap-3">
				<div className="grid gap-1.5">
					<Label htmlFor="email">Email</Label>
					<Input id="email" type="email" placeholder="Enter your email" />
				</div>
				<div className="grid gap-1.5">
					<Label htmlFor="password">Password</Label>
					<Input id="password" type="password" placeholder="Enter password" />
				</div>
				<div className="grid gap-1.5">
					<Label htmlFor="disabled">Disabled</Label>
					<Input id="disabled" disabled placeholder="Disabled input" />
				</div>
			</div>
		</Example>
	);
}

function SelectExample() {
	return (
		<Example title="Select">
			<div className="grid w-full gap-3">
				<div className="grid gap-1.5">
					<Label>Role</Label>
					<Select defaultValue="developer">
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Select a role" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="developer">Developer</SelectItem>
								<SelectItem value="designer">Designer</SelectItem>
								<SelectItem value="manager">Manager</SelectItem>
								<SelectItem value="admin">Admin</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
				<div className="grid gap-1.5">
					<Label>Size Small</Label>
					<Select>
						<SelectTrigger size="sm" className="w-full">
							<SelectValue placeholder="Select option" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="1">Option 1</SelectItem>
							<SelectItem value="2">Option 2</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
		</Example>
	);
}

function CheckboxExample() {
	const [checked, setChecked] = React.useState(true);
	return (
		<Example title="Checkbox">
			<div className="flex flex-col gap-3">
				<div className="flex items-center gap-2">
					<Checkbox
						id="terms"
						checked={checked}
						onCheckedChange={(c) => setChecked(c === true)}
					/>
					<Label htmlFor="terms">Accept terms and conditions</Label>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox id="newsletter" />
					<Label htmlFor="newsletter">Subscribe to newsletter</Label>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox id="disabled" disabled />
					<Label htmlFor="disabled" className="opacity-50">
						Disabled option
					</Label>
				</div>
			</div>
		</Example>
	);
}

function DialogExample() {
	return (
		<Example title="Dialog">
			<Dialog>
				<DialogTrigger asChild>
					<Button variant="outline">Open Dialog</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Profile</DialogTitle>
						<DialogDescription>
							Make changes to your profile here. Click save when you're done.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-3 py-2">
						<div className="grid gap-1.5">
							<Label htmlFor="name">Name</Label>
							<Input id="name" defaultValue="John Doe" />
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="username">Username</Label>
							<Input id="username" defaultValue="@johndoe" />
						</div>
					</div>
					<DialogFooter>
						<Button>Save changes</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Example>
	);
}

function AlertDialogExample() {
	return (
		<Example title="Alert Dialog">
			<div className="flex gap-2">
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="destructive">Delete Item</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogMedia>
								<TrashIcon />
							</AlertDialogMedia>
							<AlertDialogTitle>Are you sure?</AlertDialogTitle>
							<AlertDialogDescription>
								This action cannot be undone. This will permanently delete the
								item from our servers.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction variant="destructive">
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="outline">
							<BluetoothIcon data-icon="inline-start" />
							Connect
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent size="sm">
						<AlertDialogHeader>
							<AlertDialogMedia>
								<BluetoothIcon />
							</AlertDialogMedia>
							<AlertDialogTitle>Allow connection?</AlertDialogTitle>
							<AlertDialogDescription>
								Allow this device to connect via Bluetooth?
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Don't allow</AlertDialogCancel>
							<AlertDialogAction>Allow</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</Example>
	);
}

function DropdownMenuExample() {
	const [showSidebar, setShowSidebar] = React.useState(true);
	const [theme, setTheme] = React.useState("dark");

	return (
		<Example title="Dropdown Menu">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline">
						<GearIcon data-icon="inline-start" />
						Open Menu
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-56">
					<DropdownMenuLabel>My Account</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem>
							<UserIcon />
							Profile
							<DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
						</DropdownMenuItem>
						<DropdownMenuItem>
							<CreditCardIcon />
							Billing
						</DropdownMenuItem>
						<DropdownMenuItem>
							<GearIcon />
							Settings
							<DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuLabel>View</DropdownMenuLabel>
						<DropdownMenuCheckboxItem
							checked={showSidebar}
							onCheckedChange={setShowSidebar}
						>
							<EyeIcon />
							Show Sidebar
						</DropdownMenuCheckboxItem>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<PaletteIcon />
								Theme
							</DropdownMenuSubTrigger>
							<DropdownMenuPortal>
								<DropdownMenuSubContent>
									<DropdownMenuRadioGroup
										value={theme}
										onValueChange={setTheme}
									>
										<DropdownMenuRadioItem value="light">
											<SunIcon />
											Light
										</DropdownMenuRadioItem>
										<DropdownMenuRadioItem value="dark">
											<MoonIcon />
											Dark
										</DropdownMenuRadioItem>
										<DropdownMenuRadioItem value="system">
											<MonitorIcon />
											System
										</DropdownMenuRadioItem>
									</DropdownMenuRadioGroup>
								</DropdownMenuSubContent>
							</DropdownMenuPortal>
						</DropdownMenuSub>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive">
						<SignOutIcon />
						Sign Out
						<DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</Example>
	);
}

function TabsExample() {
	return (
		<Example title="Tabs">
			<Tabs defaultValue="account" className="w-full">
				<TabsList className="w-full">
					<TabsTrigger value="account" className="flex-1">
						Account
					</TabsTrigger>
					<TabsTrigger value="password" className="flex-1">
						Password
					</TabsTrigger>
					<TabsTrigger value="settings" className="flex-1">
						Settings
					</TabsTrigger>
				</TabsList>
				<TabsContent value="account" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Account</CardTitle>
							<CardDescription>
								Manage your account settings here.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid gap-1.5">
								<Label htmlFor="tab-name">Name</Label>
								<Input id="tab-name" defaultValue="John Doe" />
							</div>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="password" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Password</CardTitle>
							<CardDescription>Change your password here.</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid gap-1.5">
								<Label htmlFor="current">Current password</Label>
								<Input id="current" type="password" />
							</div>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="settings" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Settings</CardTitle>
							<CardDescription>Configure your preferences.</CardDescription>
						</CardHeader>
					</Card>
				</TabsContent>
			</Tabs>
		</Example>
	);
}

function TableExample() {
	const invoices = [
		{ id: "INV001", status: "Paid", method: "Credit Card", amount: "$250.00" },
		{ id: "INV002", status: "Pending", method: "PayPal", amount: "$150.00" },
		{
			id: "INV003",
			status: "Unpaid",
			method: "Bank Transfer",
			amount: "$350.00",
		},
	];

	return (
		<Example title="Table" containerClassName="md:col-span-2 xl:col-span-1">
			<Table>
				<TableCaption>A list of recent invoices.</TableCaption>
				<TableHeader>
					<TableRow>
						<TableHead>Invoice</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Method</TableHead>
						<TableHead className="text-right">Amount</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{invoices.map((invoice) => (
						<TableRow key={invoice.id}>
							<TableCell className="font-medium">{invoice.id}</TableCell>
							<TableCell>
								<Badge
									variant={
										invoice.status === "Paid"
											? "default"
											: invoice.status === "Pending"
												? "secondary"
												: "destructive"
									}
								>
									{invoice.status}
								</Badge>
							</TableCell>
							<TableCell>{invoice.method}</TableCell>
							<TableCell className="text-right">{invoice.amount}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Example>
	);
}

function AvatarExample() {
	return (
		<Example title="Avatar">
			<div className="flex items-center gap-3">
				<Avatar>
					<AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarImage src="https://github.com/vercel.png" alt="@vercel" />
					<AvatarFallback>VC</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarFallback>JD</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarFallback>
						<UserIcon className="size-4" />
					</AvatarFallback>
				</Avatar>
			</div>
		</Example>
	);
}

function TooltipExample() {
	return (
		<Example title="Tooltip">
			<div className="flex items-center gap-2">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="outline" size="icon">
							<PencilIcon />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Edit</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="outline" size="icon">
							<CopyIcon />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Copy to clipboard</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="outline" size="icon">
							<TrashIcon />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Delete</TooltipContent>
				</Tooltip>
			</div>
		</Example>
	);
}

function OTPExample() {
	return (
		<Example title="Input OTP">
			<div className="flex flex-col gap-3">
				<Label>Verification Code</Label>
				<InputOTP maxLength={6}>
					<InputOTPGroup>
						<InputOTPSlot index={0} />
						<InputOTPSlot index={1} />
						<InputOTPSlot index={2} />
					</InputOTPGroup>
					<InputOTPSeparator />
					<InputOTPGroup>
						<InputOTPSlot index={3} />
						<InputOTPSlot index={4} />
						<InputOTPSlot index={5} />
					</InputOTPGroup>
				</InputOTP>
				<p className="text-muted-foreground text-xs">
					Enter the 6-digit code sent to your email.
				</p>
			</div>
		</Example>
	);
}

function SkeletonExample() {
	return (
		<Example title="Skeleton">
			<div className="flex w-full items-center gap-3">
				<Skeleton className="size-10 rounded-full" />
				<div className="flex-1 space-y-2">
					<Skeleton className="h-4 w-3/4" />
					<Skeleton className="h-3 w-1/2" />
				</div>
			</div>
			<div className="w-full space-y-2">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		</Example>
	);
}

function SeparatorExample() {
	return (
		<Example title="Separator">
			<div className="w-full">
				<div className="space-y-1">
					<h4 className="text-sm font-medium leading-none">Radix Primitives</h4>
					<p className="text-muted-foreground text-sm">
						An open-source UI component library.
					</p>
				</div>
				<Separator className="my-4" />
				<div className="flex h-5 items-center gap-4 text-sm">
					<div>Blog</div>
					<Separator orientation="vertical" />
					<div>Docs</div>
					<Separator orientation="vertical" />
					<div>Source</div>
				</div>
			</div>
		</Example>
	);
}
