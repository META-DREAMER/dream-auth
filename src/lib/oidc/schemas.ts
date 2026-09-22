import { z } from "zod";

/**
 * OIDC Registration `application_type`.
 *
 * Since Better Auth 1.7 this only classifies redirect-URI policy. Client
 * authentication is decided by {@link tokenEndpointAuthMethodSchema}, not by
 * this field.
 *
 * @see https://openid.net/specs/openid-connect-registration-1_0.html#ClientMetadata
 */
export const oidcApplicationTypeSchema = z.enum(["web", "native"]);

export type OidcApplicationType = z.infer<typeof oidcApplicationTypeSchema>;

/**
 * How the client authenticates at `/oauth2/token`.
 *
 * Better Auth enforces this strictly: a client registered for
 * `client_secret_basic` that sends its credentials in the request body is
 * rejected with `invalid_client`. Pick the method the downstream app uses.
 *
 * - `client_secret_basic` - HTTP Basic auth header (RFC 6749 default)
 * - `client_secret_post` - credentials in the POST body
 * - `none` - public client, PKCE only, no secret
 */
export const tokenEndpointAuthMethodSchema = z.enum([
	"client_secret_basic",
	"client_secret_post",
	"none",
]);

export type TokenEndpointAuthMethod = z.infer<
	typeof tokenEndpointAuthMethodSchema
>;

/** Grant types supported by the Better Auth token endpoint. */
export const oidcGrantTypeSchema = z.enum([
	"authorization_code",
	"refresh_token",
	"client_credentials",
]);

export type OidcGrantType = z.infer<typeof oidcGrantTypeSchema>;

/**
 * Legacy `type` field from the pre-1.7 `oidcProvider` plugin config.
 *
 * Kept so existing `OIDC_CLIENTS` env vars and mounted ConfigMaps keep working
 * across the upgrade. It is mapped onto `applicationType` +
 * `tokenEndpointAuthMethod` by {@link oidcClientSchema}.
 *
 * @deprecated Set `applicationType` and `tokenEndpointAuthMethod` explicitly.
 */
export const legacyOidcClientTypeSchema = z.enum([
	"web",
	"native",
	"user-agent-based",
	"public",
]);

export type LegacyOidcClientType = z.infer<typeof legacyOidcClientTypeSchema>;

/**
 * Translate the legacy `type` field to the 1.7 client metadata pair.
 *
 * `web` was the only confidential variant; every other legacy value described
 * a public client, which in 1.7 means `token_endpoint_auth_method: "none"`.
 */
export function legacyTypeToClientMetadata(type: LegacyOidcClientType): {
	applicationType: OidcApplicationType;
	tokenEndpointAuthMethod: TokenEndpointAuthMethod;
} {
	switch (type) {
		case "native":
			return { applicationType: "native", tokenEndpointAuthMethod: "none" };
		case "public":
		case "user-agent-based":
			return { applicationType: "web", tokenEndpointAuthMethod: "none" };
		default:
			return {
				applicationType: "web",
				tokenEndpointAuthMethod: "client_secret_basic",
			};
	}
}

/**
 * Schema for OIDC client configuration.
 *
 * Validates `OIDC_CLIENTS` and `OIDC_CLIENTS_FILE`, and carries everything
 * needed to seed a row into the `oauthClient` table (renamed from
 * `oauthApplication` in Better Auth 1.7).
 */
export const oidcClientSchema = z
	.object({
		// Required fields
		clientId: z.string().min(1),
		name: z.string().min(1),
		redirectURLs: z.array(z.string().url()).min(1, {
			message:
				"At least one redirect URL is required for authorization_code flow",
		}),

		// 1.7 client metadata. Optional here and resolved from `type` when
		// omitted, so legacy configs stay valid.
		applicationType: oidcApplicationTypeSchema.optional(),
		tokenEndpointAuthMethod: tokenEndpointAuthMethodSchema.optional(),

		/** @deprecated use `applicationType` + `tokenEndpointAuthMethod` */
		type: legacyOidcClientTypeSchema.optional(),

		// Required on `oauthClient` in 1.7 - defaulted for the common
		// authorization-code web app.
		grantTypes: z
			.array(oidcGrantTypeSchema)
			.min(1)
			.default(["authorization_code", "refresh_token"]),
		responseTypes: z.array(z.literal("code")).min(1).default(["code"]),

		// Scopes this client may request. Defaults to the provider's scope list.
		scopes: z.array(z.string().min(1)).optional(),

		// Secret is optional for public clients using PKCE
		clientSecret: z.string().min(1).optional(),

		// UX and behavior flags
		skipConsent: z.boolean().default(false),
		disabled: z.boolean().default(false),
		requirePKCE: z.boolean().optional(),

		// Optional fields for DB seeding
		icon: z.string().optional(),
		/** Stored in a real JSON column since 1.7 (was a JSON string before). */
		metadata: z.record(z.string(), z.unknown()).optional(),
		userId: z.string().optional(),
	})
	.transform((client) => {
		const legacy = legacyTypeToClientMetadata(client.type ?? "web");
		return {
			...client,
			applicationType: client.applicationType ?? legacy.applicationType,
			tokenEndpointAuthMethod:
				client.tokenEndpointAuthMethod ?? legacy.tokenEndpointAuthMethod,
		};
	})
	.refine(
		(data) =>
			data.tokenEndpointAuthMethod === "none" || Boolean(data.clientSecret),
		{
			message:
				'clientSecret is required unless tokenEndpointAuthMethod is "none"',
			path: ["clientSecret"],
		},
	);

export type OidcClientConfig = z.infer<typeof oidcClientSchema>;
