import { describe, expect, it } from "vitest";
import { oidcClientSchema, oidcClientTypeSchema } from "./schemas";

describe("oidcClientTypeSchema", () => {
	it("accepts valid client types", () => {
		expect(oidcClientTypeSchema.parse("web")).toBe("web");
		expect(oidcClientTypeSchema.parse("native")).toBe("native");
		expect(oidcClientTypeSchema.parse("user-agent-based")).toBe(
			"user-agent-based",
		);
		expect(oidcClientTypeSchema.parse("public")).toBe("public");
	});

	it("rejects invalid client types", () => {
		expect(() => oidcClientTypeSchema.parse("invalid")).toThrow();
		expect(() => oidcClientTypeSchema.parse("")).toThrow();
		expect(() => oidcClientTypeSchema.parse(123)).toThrow();
		expect(() => oidcClientTypeSchema.parse(null)).toThrow();
	});
});

describe("oidcClientSchema", () => {
	const validWebClient = {
		clientId: "test-app",
		name: "Test Application",
		clientSecret: "super-secret-key",
		redirectURLs: ["https://app.example.com/callback"],
		type: "web",
	};

	describe("required fields", () => {
		it("accepts valid web client with all required fields", () => {
			const result = oidcClientSchema.parse(validWebClient);
			expect(result.clientId).toBe("test-app");
			expect(result.name).toBe("Test Application");
			expect(result.type).toBe("web");
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
		it("requires clientSecret for web clients", () => {
			const { clientSecret, ...withoutSecret } = validWebClient;
			expect(() => oidcClientSchema.parse(withoutSecret)).toThrow(
				/clientSecret is required/,
			);
		});

		it("requires clientSecret for native clients", () => {
			const nativeClient = {
				clientId: "native-app",
				name: "Native App",
				type: "native",
				redirectURLs: ["com.example.app://callback"],
			};
			expect(() => oidcClientSchema.parse(nativeClient)).toThrow(
				/clientSecret is required/,
			);
		});

		it("requires clientSecret for user-agent-based clients", () => {
			const userAgentClient = {
				clientId: "spa-app",
				name: "SPA App",
				type: "user-agent-based",
				redirectURLs: ["https://spa.example.com/callback"],
			};
			expect(() => oidcClientSchema.parse(userAgentClient)).toThrow(
				/clientSecret is required/,
			);
		});

		it("does NOT require clientSecret for public clients", () => {
			const publicClient = {
				clientId: "public-app",
				name: "Public Application",
				type: "public",
				redirectURLs: ["https://spa.example.com/callback"],
			};
			const result = oidcClientSchema.parse(publicClient);
			expect(result.clientSecret).toBeUndefined();
		});

		it("accepts clientSecret for public clients (optional)", () => {
			const publicClientWithSecret = {
				clientId: "public-app-with-secret",
				name: "Public Application With Secret",
				type: "public",
				clientSecret: "optional-secret",
				redirectURLs: ["https://spa.example.com/callback"],
			};
			const result = oidcClientSchema.parse(publicClientWithSecret);
			expect(result.clientSecret).toBe("optional-secret");
		});
	});

	describe("defaults", () => {
		it("defaults type to 'web'", () => {
			const result = oidcClientSchema.parse({
				clientId: "test",
				name: "Test",
				clientSecret: "secret",
				redirectURLs: ["https://example.com/cb"],
			});
			expect(result.type).toBe("web");
		});

		it("defaults skipConsent to false", () => {
			const result = oidcClientSchema.parse(validWebClient);
			expect(result.skipConsent).toBe(false);
		});

		it("defaults disabled to false", () => {
			const result = oidcClientSchema.parse(validWebClient);
			expect(result.disabled).toBe(false);
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
	});

	describe("all client types", () => {
		it("parses web client correctly", () => {
			const result = oidcClientSchema.parse({
				...validWebClient,
				type: "web",
			});
			expect(result.type).toBe("web");
		});

		it("parses native client correctly", () => {
			const result = oidcClientSchema.parse({
				clientId: "native-app",
				name: "Native App",
				clientSecret: "native-secret",
				type: "native",
				redirectURLs: ["com.example.app://callback"],
			});
			expect(result.type).toBe("native");
		});

		it("parses user-agent-based client correctly", () => {
			const result = oidcClientSchema.parse({
				clientId: "spa-app",
				name: "SPA App",
				clientSecret: "spa-secret",
				type: "user-agent-based",
				redirectURLs: ["https://spa.example.com/callback"],
			});
			expect(result.type).toBe("user-agent-based");
		});

		it("parses public client correctly", () => {
			const result = oidcClientSchema.parse({
				clientId: "public-app",
				name: "Public App",
				type: "public",
				redirectURLs: ["https://public.example.com/callback"],
			});
			expect(result.type).toBe("public");
		});
	});
});
