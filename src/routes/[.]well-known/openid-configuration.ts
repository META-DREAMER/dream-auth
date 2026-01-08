import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";
import type { ServerRouteHandler } from "@/lib/server-handler";

/**
 * OIDC Discovery endpoint alias at root level.
 * Proxies requests to BetterAuth's OIDC discovery endpoint at /api/auth/.well-known/openid-configuration
 *
 * This allows the OIDC issuer to be at the root domain (Option B from PRD)
 * rather than under /api/auth.
 */

export const GET: ServerRouteHandler = async ({ request }) => {
	// Create a new request targeting the BetterAuth OIDC discovery endpoint
	const url = new URL(request.url);
	const internalUrl = new URL(
		"/api/auth/.well-known/openid-configuration",
		url.origin,
	);

	const internalRequest = new Request(internalUrl.toString(), {
		method: "GET",
		headers: request.headers,
	});

	const response = await auth.handler(internalRequest);

	// Modify the response to reflect root-level endpoints
	if (response.ok) {
		const data = await response.json();

		// Rewrite endpoints to use root-level paths
		const rootUrl = url.origin;
		const modifiedData = {
			...data,
			issuer: rootUrl,
			authorization_endpoint: `${rootUrl}/oauth2/authorize`,
			token_endpoint: `${rootUrl}/oauth2/token`,
			userinfo_endpoint: `${rootUrl}/oauth2/userinfo`,
			jwks_uri: `${rootUrl}/.well-known/jwks.json`,
			end_session_endpoint: `${rootUrl}/oauth2/endsession`,
			// Also rewrite optional endpoints if present
			...(data.revocation_endpoint && {
				revocation_endpoint: `${rootUrl}/oauth2/revoke`,
			}),
			...(data.introspection_endpoint && {
				introspection_endpoint: `${rootUrl}/oauth2/introspect`,
			}),
		};

		return new Response(JSON.stringify(modifiedData), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=3600",
			},
		});
	}

	return response;
};

export const Route = createFileRoute("/.well-known/openid-configuration")({
	server: {
		handlers: { GET },
	},
});
