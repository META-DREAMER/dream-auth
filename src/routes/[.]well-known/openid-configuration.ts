import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";
import type { ServerRouteHandler } from "@/lib/server-handler";

/**
 * OIDC Discovery at the root (Option B from the PRD).
 *
 * The `issuer` is taken unchanged from @better-auth/oauth-provider, which
 * reads it from the jwt plugin's `jwt.issuer` (src/lib/oidc/issuer.ts): the
 * same value it puts in the callback `iss` parameter and in every token's
 * `iss` claim. Only the endpoints are rewritten, to the root-level aliases
 * served by src/routes/oauth2/$.ts and src/routes/[.]well-known/jwks[.]json.ts.
 *
 * `getOpenIdConfig` is a server-only endpoint. Over HTTP the plugin answers
 * only at `<issuer path>/.well-known/openid-configuration`, which with a root
 * issuer is this route, not /api/auth/.well-known/openid-configuration, so the
 * metadata is read through `auth.api` rather than `auth.handler`.
 */

export const GET: ServerRouteHandler = async ({ request }) => {
	let data: Record<string, unknown> & { issuer: string };
	try {
		data = await auth.api.getOpenIdConfig({ headers: request.headers });
	} catch (error) {
		console.error("[OIDC] discovery metadata unavailable:", error);
		return new Response("Not Found", { status: 404 });
	}

	const root = data.issuer;
	const modifiedData = {
		...data,
		authorization_endpoint: `${root}/oauth2/authorize`,
		token_endpoint: `${root}/oauth2/token`,
		userinfo_endpoint: `${root}/oauth2/userinfo`,
		jwks_uri: `${root}/.well-known/jwks.json`,
		end_session_endpoint: `${root}/oauth2/end-session`,
		...(data.revocation_endpoint !== undefined && {
			revocation_endpoint: `${root}/oauth2/revoke`,
		}),
		...(data.introspection_endpoint !== undefined && {
			introspection_endpoint: `${root}/oauth2/introspect`,
		}),
	};

	return new Response(JSON.stringify(modifiedData), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

export const Route = createFileRoute("/.well-known/openid-configuration")({
	server: {
		handlers: { GET },
	},
});
