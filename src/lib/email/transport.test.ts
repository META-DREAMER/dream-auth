import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createCloudflareTransport,
	createTransport,
	logTransport,
} from "@/lib/email/transport";
import type { EmailConfig, SendEmailInput } from "@/lib/email/types";

const INPUT: SendEmailInput = {
	to: "user@example.com",
	subject: "Your sign-in code",
	html: "<p>123456</p>",
	text: "123456",
};

const BASE_CONFIG: EmailConfig = {
	provider: "cloudflare",
	from: "noreply@md.wtf",
	fromName: "Dream Auth",
	accountId: "acct-123",
	apiToken: "token-abc",
};

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function cloudflare() {
	return createCloudflareTransport({
		accountId: "acct-123",
		apiToken: "token-abc",
		from: "noreply@md.wtf",
		fromName: "Dream Auth",
	});
}

describe("logTransport", () => {
	const originalNodeEnv = process.env.NODE_ENV;

	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		process.env.NODE_ENV = originalNodeEnv;
		vi.restoreAllMocks();
	});

	it("succeeds without issuing a request", async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);

		await expect(logTransport(INPUT)).resolves.toEqual({ ok: true });
		expect(fetchSpy).not.toHaveBeenCalled();

		vi.unstubAllGlobals();
	});

	it("prints the body outside production", async () => {
		process.env.NODE_ENV = "development";
		await logTransport(INPUT);
		const printed = vi.mocked(console.log).mock.calls.flat().join("\n");
		expect(printed).toContain("123456");
	});

	it("never prints the body in production", async () => {
		process.env.NODE_ENV = "production";
		await logTransport(INPUT);
		const printed = vi.mocked(console.log).mock.calls.flat().join("\n");
		expect(printed).not.toContain("123456");
		expect(printed).not.toContain("<p>");
		expect(printed).toContain("user@example.com");
	});
});

describe("createCloudflareTransport", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("posts to the account-scoped send endpoint with a bearer token", async () => {
		const fetchSpy = vi.fn().mockResolvedValue(
			jsonResponse({
				success: true,
				result: {
					delivered: ["user@example.com"],
					permanent_bounces: [],
					queued: [],
				},
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await cloudflare()(INPUT);

		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe(
			"https://api.cloudflare.com/client/v4/accounts/acct-123/email/sending/send",
		);
		expect(init.method).toBe("POST");
		expect(init.headers.Authorization).toBe("Bearer token-abc");
		expect(init.headers["Content-Type"]).toBe("application/json");
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it("uses the REST field names, not the Workers binding ones", async () => {
		const fetchSpy = vi.fn().mockResolvedValue(
			jsonResponse({
				success: true,
				result: {
					delivered: ["user@example.com"],
					permanent_bounces: [],
					queued: [],
				},
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		await cloudflare()(INPUT);

		const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
		expect(body.from).toEqual({
			address: "noreply@md.wtf",
			name: "Dream Auth",
		});
		// The Workers `send_email` binding uses `from.email`; REST does not.
		expect(body.from.email).toBeUndefined();
		expect(body).not.toHaveProperty("replyTo");
		expect(body.to).toBe("user@example.com");
		expect(body.subject).toBe("Your sign-in code");
		expect(body.html).toBe("<p>123456</p>");
		expect(body.text).toBe("123456");
	});

	it("treats a delivered recipient as success", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				jsonResponse({
					success: true,
					result: {
						delivered: ["user@example.com"],
						permanent_bounces: [],
						queued: [],
					},
				}),
			),
		);
		await expect(cloudflare()(INPUT)).resolves.toEqual({ ok: true });
	});

	it("treats a queued recipient as success", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				jsonResponse({
					success: true,
					result: {
						delivered: [],
						permanent_bounces: [],
						queued: ["user@example.com"],
					},
				}),
			),
		);
		await expect(cloudflare()(INPUT)).resolves.toEqual({ ok: true });
	});

	it("treats a permanent bounce as a non-retryable failure", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				jsonResponse({
					success: true,
					result: {
						delivered: [],
						permanent_bounces: ["user@example.com"],
						queued: [],
					},
				}),
			),
		);
		const result = await cloudflare()(INPUT);
		expect(result).toMatchObject({
			ok: false,
			code: "PERMANENT_BOUNCE",
			retryable: false,
		});
	});

	it("fails when no recipient was accepted at all", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				jsonResponse({
					success: true,
					errors: [{ code: "E_RECIPIENT_SUPPRESSED", message: "suppressed" }],
					result: { delivered: [], permanent_bounces: [], queued: [] },
				}),
			),
		);
		const result = await cloudflare()(INPUT);
		expect(result).toMatchObject({
			ok: false,
			code: "E_RECIPIENT_SUPPRESSED",
			retryable: false,
		});
	});

	it.each([429, 500, 503])("marks HTTP %i retryable", async (status) => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					jsonResponse(
						{ success: false, errors: [{ code: 1000, message: "boom" }] },
						status,
					),
				),
		);
		const result = await cloudflare()(INPUT);
		expect(result).toMatchObject({ ok: false, retryable: true });
		expect(result.ok === false && result.code).toContain(`HTTP_${status}`);
	});

	it.each([400, 401, 403])("marks HTTP %i non-retryable", async (status) => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					jsonResponse(
						{ success: false, errors: [{ code: 10000, message: "nope" }] },
						status,
					),
				),
		);
		await expect(cloudflare()(INPUT)).resolves.toMatchObject({
			ok: false,
			retryable: false,
		});
	});

	it("handles an unparseable error body", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("not json", { status: 502 })),
		);
		await expect(cloudflare()(INPUT)).resolves.toMatchObject({
			ok: false,
			code: "HTTP_502",
			retryable: true,
		});
	});

	it("converts a network failure into a retryable result instead of throwing", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
		await expect(cloudflare()(INPUT)).resolves.toEqual({
			ok: false,
			code: "NETWORK_ERROR",
			message: "ECONNRESET",
			retryable: true,
		});
	});
});

describe("createTransport", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("selects the log transport for provider=log", () => {
		expect(createTransport({ ...BASE_CONFIG, provider: "log" })).toBe(
			logTransport,
		);
	});

	it("selects the Cloudflare transport when credentials are present", async () => {
		const transport = createTransport(BASE_CONFIG);
		expect(transport).not.toBe(logTransport);

		const fetchSpy = vi.fn().mockResolvedValue(
			jsonResponse({
				success: true,
				result: {
					delivered: ["user@example.com"],
					permanent_bounces: [],
					queued: [],
				},
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);
		await transport(INPUT);
		expect(fetchSpy).toHaveBeenCalledOnce();
	});

	it.each([
		"accountId",
		"apiToken",
	] as const)("falls back to the log transport when %s is missing", (missing) => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const transport = createTransport({ ...BASE_CONFIG, [missing]: undefined });
		expect(transport).toBe(logTransport);
		expect(console.error).toHaveBeenCalled();
	});
});
