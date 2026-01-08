import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";
import type { ServerRouteHandler } from "@/lib/server-handler";

/**
 * OAuth2 endpoints alias at root level.
 * Proxies requests from /oauth2/* to BetterAuth's /api/auth/oauth2/*
 *
 * Supported endpoints:
 * - GET/POST /oauth2/authorize - Authorization endpoint
 * - POST /oauth2/token - Token exchange endpoint
 * - GET /oauth2/userinfo - User info endpoint
 * - POST /oauth2/consent - Consent submission
 * - POST /oauth2/register - Dynamic client registration
 * - GET /oauth2/client/:id - Client info
 * - GET/POST /oauth2/endsession - Session termination
 *
 * This allows the OIDC provider to use root-level OAuth2 endpoints (Option B from PRD).
 */

type OAuth2Params = { _splat?: string };

export const GET: ServerRouteHandler<OAuth2Params> = async ({
	request,
	params,
}) => {
	return proxyToAuth(request, params._splat);
};

export const POST: ServerRouteHandler<OAuth2Params> = async ({
	request,
	params,
}) => {
	return proxyToAuth(request, params._splat);
};

export const Route = createFileRoute("/oauth2/$")({
	server: {
		handlers: { GET, POST },
	},
});

/**
 * Proxy request to BetterAuth's OAuth2 handler
 */
async function proxyToAuth(
	request: Request,
	splat: string | undefined,
): Promise<Response> {
	const url = new URL(request.url);

	// Construct the internal BetterAuth OAuth2 endpoint URL
	const internalPath = `/api/auth/oauth2/${splat || ""}`;
	const internalUrl = new URL(internalPath, url.origin);

	// Preserve query parameters
	internalUrl.search = url.search;

	// Clone the request with the new URL
	const internalRequest = new Request(internalUrl.toString(), {
		method: request.method,
		headers: request.headers,
		body: request.body,
		// @ts-expect-error - duplex is needed for streaming bodies
		duplex: "half",
	});

	// Forward to BetterAuth handler
	const response = await auth.handler(internalRequest);

	// BetterAuth may return JSON redirect instructions for client-side routing
	// Convert these to HTTP redirects for browser access
	if (response.ok) {
		const contentType = response.headers.get("content-type");
		if (contentType?.includes("application/json")) {
			try {
				const data = await response.clone().json();
				// Check if BetterAuth returned a redirect instruction
				if (data.redirect === true && typeof data.url === "string") {
					// Convert to HTTP redirect
					const redirectUrl = data.url.startsWith("http")
						? data.url
						: new URL(data.url, url.origin).toString();
					return new Response(null, {
						status: 302,
						headers: {
							Location: redirectUrl,
						},
					});
				}
			} catch {
				// Not JSON or not a redirect instruction, return as-is
			}
		}
	}

	return response;
}
