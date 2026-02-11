import { z } from "zod";

/**
 * Zod response schemas for custom API endpoints.
 * Used in contract tests to verify handler responses match their expected shape.
 */

// GET /api/health
export const healthResponseSchema = z.object({
	status: z.literal("ok"),
	timestamp: z.iso.datetime(),
});

// GET /api/verify (200 response) — returns no body, only headers
export const verifyHeadersSchema = z.object({
	"x-auth-user": z.string(),
	"x-auth-id": z.string().min(1),
	"x-auth-email": z.email(),
});

// GET /.well-known/openid-configuration
export const oidcDiscoveryResponseSchema = z.object({
	issuer: z.url(),
	authorization_endpoint: z.url(),
	token_endpoint: z.url(),
	userinfo_endpoint: z.url(),
	jwks_uri: z.url(),
	end_session_endpoint: z.url(),
	// Optional endpoints
	revocation_endpoint: z.url().optional(),
	introspection_endpoint: z.url().optional(),
	// Standard OIDC metadata (passthrough from BetterAuth)
	scopes_supported: z.array(z.string()).optional(),
	response_types_supported: z.array(z.string()).optional(),
	grant_types_supported: z.array(z.string()).optional(),
	subject_types_supported: z.array(z.string()).optional(),
	id_token_signing_alg_values_supported: z.array(z.string()).optional(),
});

// JWK (JSON Web Key) — individual key in JWKS, allows extra fields (n, e, etc.)
const jwkSchema = z.looseObject({
	kty: z.string(),
	use: z.string().optional(),
	kid: z.string().optional(),
	alg: z.string().optional(),
});

// GET /.well-known/jwks.json
export const jwksResponseSchema = z.object({
	keys: z.array(jwkSchema),
});
