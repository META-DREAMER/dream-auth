import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { getSessionFn } from "@/lib/session.server";
import { Web3Provider } from "@/components/web3-provider";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
	beforeLoad: async () => {
		const session = await getSessionFn();
		return { session };
	},
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Auth Server",
			},
			{
				name: "description",
				content: "Home Cluster Identity Provider",
			},
			
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	shellComponent: RootDocument,
	component: RootComponent,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark">
			<head>
				<HeadContent />
			</head>
			<body data-vaul-drawer-wrapper="" className="bg-background">
				{children}
				{process.env.NODE_ENV === "development" && (
					<TanStackDevtools
						config={{
							position: "bottom-right",
						}}
						plugins={[
							{
								name: "Tanstack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
						]}
					/>
				)}
				<Scripts />
			</body>
		</html>
	);
}

function RootComponent() {
	return (
		<Web3Provider>
			<Outlet />
		</Web3Provider>
	);
}
