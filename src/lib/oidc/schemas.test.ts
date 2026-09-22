import { describe, expect, it } from "vitest";
import {
	legacyOidcClientTypeSchema,
	legacyTypeToClientMetadata,
	oidcApplicationTypeSchema,
	oidcClientSchema,
	tokenEndpointAuthMethodSchema,
} from "./schemas";

describe("oidcApplicationTypeSchema", () => {
	it("accepts the OIDC registration application types", () => {
		expect(oidcApplicationTypeSchema.parse("web")).toBe("web");
		expect(oidcApplicationTypeSchema.parse("native")).toBe("native");
	});

	it("rejects the removed pre-1.7 client types", () => {
		expect(() => oidcApplicationTypeSchema.parse("public")).toThrow();
		expect(() => oidcApplicationTypeSchema.parse("user-agent-based")).toThrow();
	});
});

describe("tokenEndpointAuthMethodSchema", () => {
	it("accepts the supported authentication methods", () => {
		expect(tokenEndpointAuthMethodSchema.parse("client_secret_basic")).toBe(
			"client_secret_basic",
		);
		expect(tokenEndpointAuthMethodSchema.parse("client_secret_post")).toBe(
			"client_secret_post",
		);
		expect(tokenEndpointAuthMethodSchema.parse("none")).toBe("none");
	});

	it("rejects unknown methods", () => {
		expect(() =>
			tokenEndpointAuthMethodSchema.parse("private_key_jwt"),
		).toThrow();
		expect(() => tokenEndpointAuthMethodSchema.parse("")).toThrow();
	});
});

describe("legacyTypeToClientMetadata", () => {
	it("maps web to a confidential client", () => {
		expect(legacyTypeToClientMetadata("web")).toEqual({
			applicationType: "web",
			tokenEndpointAuthMethod: "client_secret_basic",
		});
	});

	it("maps native to a public native client", () => {
		expect(legacyTypeToClientMetadata("native")).toEqual({
			applicationType: "native",
			tokenEndpointAuthMethod: "none",
		});
	});

	it("maps browser-based types to public web clients", () => {
		for (const type of ["public", "user-agent-based"] as const) {
			expect(legacyTypeToClientMetadata(type)).toEqual({
				applicationType: "web",
				tokenEndpointAuthMethod: "none",
			});
		}
	});

	it("still accepts every legacy type value", () => {
		for (const type of ["web", "native", "user-agent-based", "public"]) {
			expect(legacyOidcClientTypeSchema.parse(type)).toBe(type);
		}
	});
});

describe("oidcClientSchema", () => {
	const validWebClient = {
		clientId: "test-app",
		name: "Test Application",
		clientSecret: "super-secret-key",
		redirectURLs: ["https://app.example.com/callback"],
	};

	describe("required fields", () => {
		it("accepts a valid web client with all required fields", () => {
			const result = oidcClientSchema.parse(validWebClient);
			expect(result.clientId).toBe("test-app");
			expect(result.name).toBe("Test Application");
			expect(result.applicationType).toBe("web");
		});

		it("rejects empty clientId", () => {
			expect(() =>
				oidcClientSchema.parse({ ...validWebClient, clientId: "" }),
			).toThrow();
		});

		it("rejects empty name", () => {
			expect(() =>
				oidcClientSchema.parse({ ...validWebClient, name: "" }),
			).toThrow();
		});

		it("requires at least one redirect URL", () => {
			expect(() =>
				oidcClientSchema.parse({ ...validWebClient, redirectURLs: [] }),
			).toThrow(/At least one redirect URL/);
		});

		it("validates redirect URLs are valid URLs", () => {
			expect(() =>
				oidcClientSchema.parse({
					...validWebClient,
					redirectURLs: ["not-a-url"],
				}),
			).toThrow();
		});

		it("accepts multiple valid redirect URLs", () => {
			const result = oidcClientSchema.parse({
				...validWebClient,
				redirectURLs: [
					"https://app.example.com/callback",
					"https://app.example.com/auth/callback",
					"http://localhost:3000/callback",
				],
			});
			expect(result.redirectURLs).toHaveLength(3);
		});
	});

	describe("clientSecret requirement", () => {
		it("requires clientSecret for confidential clients", () => {
			const { clientSecret: _clientSecret, ...withoutSecret } = validWebClient;
			expect(() => oidcClientSchema.parse(withoutSecret)).toThrow(
				/clientSecret is required/,
			);
		});

		it("requires clientSecret for client_secret_post", () => {
			const { clientSecret: _clientSecret, ...withoutSecret } = validWebClient;
			expect(() =>
				oidcClientSchema.parse({
					...withoutSecret,
					tokenEndpointAuthMethod: "client_secret_post",
				}),
			).toThrow(/clientSecret is required/);
		});

		it("does not require clientSecret for public clients", () => {
			const result = oidcClientSchema.parse({
				clientId: "public-app",
				name: "Public Application",
				tokenEndpointAuthMethod: "none",
				redirectURLs: ["https://spa.example.com/callback"],
			});
			expect(result.clientSecret).toBeUndefined();
			expect(result.tokenEndpointAuthMethod).toBe("none");
		});

		it("does not require clientSecret for the legacy public type", () => {
			const result = oidcClientSchema.parse({
				clientId: "public-app",
				name: "Public Application",
				type: "public",
				redirectURLs: ["https://spa.example.com/callback"],
			});
			expect(result.clientSecret).toBeUndefined();
			expect(result.tokenEndpointAuthMethod).toBe("none");
		});
	});

	describe("defaults", () => {
		it("defaults applicationType to 'web'", () => {
			expect(oidcClientSchema.parse(validWebClient).applicationType).toBe(
				"web",
			);
		});

		it("defaults tokenEndpointAuthMethod to client_secret_basic", () => {
			expect(
				oidcClientSchema.parse(validWebClient).tokenEndpointAuthMethod,
			).toBe("client_secret_basic");
		});

		it("defaults grantTypes to authorization_code + refresh_token", () => {
			expect(oidcClientSchema.parse(validWebClient).grantTypes).toEqual([
				"authorization_code",
				"refresh_token",
			]);
		});

		it("defaults responseTypes to ['code']", () => {
			expect(oidcClientSchema.parse(validWebClient).responseTypes).toEqual([
				"code",
			]);
		});

		it("defaults skipConsent to false", () => {
			expect(oidcClientSchema.parse(validWebClient).skipConsent).toBe(false);
		});

		it("defaults disabled to false", () => {
			expect(oidcClientSchema.parse(validWebClient).disabled).toBe(false);
		});

		it("leaves requirePKCE unset so the provider default applies", () => {
			expect(
				oidcClientSchema.parse(validWebClient).requirePKCE,
			).toBeUndefined();
		});
	});

	describe("legacy `type` compatibility", () => {
		it("keeps an existing type:web config working", () => {
			const result = oidcClientSchema.parse({ ...validWebClient, type: "web" });
			expect(result.applicationType).toBe("web");
			expect(result.tokenEndpointAuthMethod).toBe("client_secret_basic");
		});

		it("maps type:native onto a public native client", () => {
			const result = oidcClientSchema.parse({
				clientId: "native-app",
				name: "Native App",
				type: "native",
				redirectURLs: ["com.example.app://callback"],
			});
			expect(result.applicationType).toBe("native");
			expect(result.tokenEndpointAuthMethod).toBe("none");
		});

		it("maps type:user-agent-based onto a public web client", () => {
			const result = oidcClientSchema.parse({
				clientId: "spa-app",
				name: "SPA App",
				type: "user-agent-based",
				redirectURLs: ["https://spa.example.com/callback"],
			});
			expect(result.applicationType).toBe("web");
			expect(result.tokenEndpointAuthMethod).toBe("none");
		});

		it("lets explicit fields win over the legacy type", () => {
			const result = oidcClientSchema.parse({
				...validWebClient,
				type: "public",
				tokenEndpointAuthMethod: "client_secret_post",
			});
			expect(result.tokenEndpointAuthMethod).toBe("client_secret_post");
		});
	});

	describe("optional fields", () => {
		it("accepts icon URL", () => {
			const result = oidcClientSchema.parse({
				...validWebClient,
				icon: "https://example.com/icon.png",
			});
			expect(result.icon).toBe("https://example.com/icon.png");
		});

		it("accepts metadata object", () => {
			const result = oidcClientSchema.parse({
				...validWebClient,
				metadata: { custom: "value", nested: { key: "val" } },
			});
			expect(result.metadata).toEqual({
				custom: "value",
				nested: { key: "val" },
			});
		});

		it("accepts userId", () => {
			const result = oidcClientSchema.parse({
				...validWebClient,
				userId: "user-123",
			});
			expect(result.userId).toBe("user-123");
		});

		it("accepts an explicit scope allowlist", () => {
			const result = oidcClientSchema.parse({
				...validWebClient,
				scopes: ["openid", "email"],
			});
			expect(result.scopes).toEqual(["openid", "email"]);
		});

		it("accepts an explicit requirePKCE override", () => {
			const result = oidcClientSchema.parse({
				...validWebClient,
				requirePKCE: false,
			});
			expect(result.requirePKCE).toBe(false);
		});

		it("accepts skipConsent as true", () => {
			const result = oidcClientSchema.parse({
				...validWebClient,
				skipConsent: true,
			});
			expect(result.skipConsent).toBe(true);
		});

		it("accepts disabled as true", () => {
			const result = oidcClientSchema.parse({
				...validWebClient,
				disabled: true,
			});
			expect(result.disabled).toBe(true);
		});

		it("rejects an unsupported grant type", () => {
			expect(() =>
				oidcClientSchema.parse({
					...validWebClient,
					grantTypes: ["implicit"],
				}),
			).toThrow();
		});
	});
});
