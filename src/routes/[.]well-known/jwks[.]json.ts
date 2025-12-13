import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";

/**
 * JWKS endpoint alias at root level.
 * Proxies requests to BetterAuth's JWKS endpoint at /api/auth/jwks
 *
 * This allows clients to fetch the JSON Web Key Set from the root domain
 * for verifying ID tokens signed by this OIDC provider.
 */
export const Route = createFileRoute("/.well-known/jwks.json")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				// Create a new request targeting the BetterAuth JWKS endpoint
				const url = new URL(request.url);
				const internalUrl = new URL(
					"/api/auth/jwks",
					url.origin,
				)

				const internalRequest = new Request(internalUrl.toString(), {
					method: "GET",
					headers: request.headers,
				})

				const response = await auth.handler(internalRequest);

				// Add caching headers for JWKS (BetterAuth doesn't set these by default)
				// This is important for OIDC clients to cache JWKS efficiently
				if (response.ok) {
					const data = await response.json();
					// Preserve BetterAuth's headers and add/override Cache-Control
					const headers = new Headers(response.headers);
					headers.set("Cache-Control", "public, max-age=3600, must-revalidate");
					
					return new Response(JSON.stringify(data), {
						status: 200,
						headers,
					})
				}

				return response;
			},
			HEAD: async ({ request }) => {
				// Handle HEAD requests for cache header checks
				// BetterAuth may not support HEAD, so we return headers directly
				// First verify the endpoint exists by making a GET request
				const url = new URL(request.url);
				const internalUrl = new URL(
					"/api/auth/jwks",
					url.origin,
				)

				const internalRequest = new Request(internalUrl.toString(), {
					method: "GET",
					headers: request.headers,
				})

				const response = await auth.handler(internalRequest);

				// Return HEAD response with caching headers if GET succeeds
				if (response.ok) {
					// Preserve BetterAuth's headers and add/override Cache-Control
					const headers = new Headers(response.headers);
					headers.set("Cache-Control", "public, max-age=3600, must-revalidate");
					
					return new Response(null, {
						status: 200,
						headers,
					})
				}

				return new Response(null, { status: response.status });
			},
		},
	},
});
