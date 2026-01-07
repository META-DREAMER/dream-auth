import { z } from "zod";

/**
 * Valid OIDC client types as defined by RFC6749 and Better Auth.
 * - "web": Server-side web application (confidential client)
 * - "native": Mobile/desktop application
 * - "user-agent-based": SPA running in browser
 * - "public": Public client using PKCE (no client_secret required)
 */
export const oidcClientTypeSchema = z.enum([
	"web",
	"native",
	"user-agent-based",
	"public",
]);

export type OidcClientType = z.infer<typeof oidcClientTypeSchema>;

/**
 * Schema for OIDC client configuration.
 * Used to validate OIDC_CLIENTS environment variable and OIDC_CLIENTS_FILE.
 * This schema includes all fields needed for DB seeding into oauthApplication table.
 */
export const oidcClientSchema = z
	.object({
		// Required fields
		clientId: z.string().min(1),
		name: z.string().min(1),
		redirectURLs: z.array(z.string().url()).min(1, {
			message: "At least one redirect URL is required for authorization_code flow",
		}),

		// Client type (defaults to "web" for confidential clients)
		type: oidcClientTypeSchema.default("web"),

		// Secret is optional for public clients using PKCE
		clientSecret: z.string().min(1).optional(),

		// UX and behavior flags
		skipConsent: z.boolean().default(false),
		disabled: z.boolean().default(false),

		// Optional fields for DB seeding
		icon: z.string().optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
		userId: z.string().optional(),
	})
	.refine(
		(data) => {
			// clientSecret is required for non-public clients
			if (data.type !== "public" && !data.clientSecret) {
				return false;
			}
			return true;
		},
		{
			message: "clientSecret is required for non-public clients",
			path: ["clientSecret"],
		},
	);

export type OidcClientConfig = z.infer<typeof oidcClientSchema>;








