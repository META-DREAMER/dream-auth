import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ context, location }) => {
		if (!context.session) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}

		// Pass session to child routes
		return { session: context.session };
	},
	component: AuthedLayout,
});

function AuthedLayout() {
	return <Outlet />;
}
