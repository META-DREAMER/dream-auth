import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ context, location }) => {
		if (!context.session) {
			// `location.href` is a same-origin path here; `/login` validates it
			// again before anything navigates.
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
