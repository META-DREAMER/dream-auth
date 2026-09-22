import { describe, expect, it } from "vitest";
import { emailEnvSchema } from "@/env";

describe("emailEnvSchema", () => {
	it("defaults to the log provider so local dev needs no credentials", () => {
		const parsed = emailEnvSchema.parse({});
		expect(parsed).toEqual({
			EMAIL_PROVIDER: "log",
			EMAIL_FROM: "noreply@example.invalid",
			EMAIL_FROM_NAME: "Dream Auth",
		});
	});

	it("does not require the Cloudflare vars for the log provider", () => {
		expect(() => emailEnvSchema.parse({ EMAIL_PROVIDER: "log" })).not.toThrow();
	});

	it("accepts the cloudflare provider when both credentials are present", () => {
		const parsed = emailEnvSchema.parse({
			EMAIL_PROVIDER: "cloudflare",
			EMAIL_FROM: "noreply@md.wtf",
			CLOUDFLARE_ACCOUNT_ID: "acct",
			CLOUDFLARE_API_TOKEN: "token",
		});
		expect(parsed.EMAIL_PROVIDER).toBe("cloudflare");
		expect(parsed.EMAIL_FROM).toBe("noreply@md.wtf");
	});

	it.each([
		["CLOUDFLARE_ACCOUNT_ID", { CLOUDFLARE_API_TOKEN: "token" }],
		["CLOUDFLARE_API_TOKEN", { CLOUDFLARE_ACCOUNT_ID: "acct" }],
	])("rejects the cloudflare provider without %s", (missing, rest) => {
		const result = emailEnvSchema.safeParse({
			EMAIL_PROVIDER: "cloudflare",
			EMAIL_FROM: "noreply@md.wtf",
			...rest,
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues.map((i) => i.path[0])).toContain(missing);
	});

	it("reports both credentials and the placeholder sender when nothing is set", () => {
		const result = emailEnvSchema.safeParse({ EMAIL_PROVIDER: "cloudflare" });
		expect(result.success).toBe(false);
		expect(result.error?.issues.map((i) => i.path[0]).sort()).toEqual([
			"CLOUDFLARE_ACCOUNT_ID",
			"CLOUDFLARE_API_TOKEN",
			"EMAIL_FROM",
		]);
	});

	it("rejects the placeholder sender with the cloudflare provider", () => {
		const result = emailEnvSchema.safeParse({
			EMAIL_PROVIDER: "cloudflare",
			CLOUDFLARE_ACCOUNT_ID: "acct",
			CLOUDFLARE_API_TOKEN: "token",
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues.map((i) => i.path[0])).toEqual(["EMAIL_FROM"]);
	});

	it("rejects an unknown provider", () => {
		expect(emailEnvSchema.safeParse({ EMAIL_PROVIDER: "resend" }).success).toBe(
			false,
		);
	});

	it("rejects a malformed EMAIL_FROM", () => {
		expect(
			emailEnvSchema.safeParse({ EMAIL_FROM: "not-an-email" }).success,
		).toBe(false);
	});
});
