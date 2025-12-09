import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";

export const Route = createFileRoute("/api/verify")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const session = await auth.api.getSession({ headers: request.headers });

				if (!session) {
					return new Response(null, { status: 401 });
				}

				// Return user information in headers for forward-auth
				return new Response(null, {
					status: 200,
					headers: {
						"X-Auth-User": session.user.name || "",
						"X-Auth-Id": session.user.id,
						"X-Auth-Email": session.user.email,
					},
				});
			},
		},
	},
});
