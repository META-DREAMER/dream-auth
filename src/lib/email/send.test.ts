import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	emailConfigFromEnv,
	resetEmailTransport,
	sendEmail,
} from "@/lib/email/send";
import type { EmailTransport, SendEmailInput } from "@/lib/email/types";

const INPUT: SendEmailInput = {
	to: "user@example.com",
	subject: "Your sign-in code",
	html: "<p>424242</p>",
	text: "424242",
};

describe("sendEmail", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		resetEmailTransport();
	});

	async function run(transport: EmailTransport) {
		const promise = sendEmail(INPUT, { transport });
		await vi.runAllTimersAsync();
		return promise;
	}

	it("returns the transport result on success and calls it once", async () => {
		const transport = vi.fn<EmailTransport>().mockResolvedValue({ ok: true });
		await expect(run(transport)).resolves.toEqual({ ok: true });
		expect(transport).toHaveBeenCalledOnce();
	});

	it("retries exactly once on a retryable failure", async () => {
		const transport = vi
			.fn<EmailTransport>()
			.mockResolvedValueOnce({
				ok: false,
				code: "NETWORK_ERROR",
				message: "boom",
				retryable: true,
			})
			.mockResolvedValueOnce({ ok: true });

		await expect(run(transport)).resolves.toEqual({ ok: true });
		expect(transport).toHaveBeenCalledTimes(2);
	});

	it("stops after the single retry when both attempts fail", async () => {
		const transport = vi.fn<EmailTransport>().mockResolvedValue({
			ok: false,
			code: "HTTP_500",
			message: "boom",
			retryable: true,
		});

		await expect(run(transport)).resolves.toMatchObject({ ok: false });
		expect(transport).toHaveBeenCalledTimes(2);
	});

	it("never retries a permanent failure", async () => {
		const transport = vi.fn<EmailTransport>().mockResolvedValue({
			ok: false,
			code: "PERMANENT_BOUNCE",
			message: "dead address",
			retryable: false,
		});

		await expect(run(transport)).resolves.toMatchObject({
			ok: false,
			code: "PERMANENT_BOUNCE",
		});
		expect(transport).toHaveBeenCalledOnce();
	});

	it("logs a structured success line that carries no message body", async () => {
		await run(vi.fn<EmailTransport>().mockResolvedValue({ ok: true }));

		const line = vi.mocked(console.log).mock.calls.flat().join("\n");
		expect(JSON.parse(line)).toEqual({
			event: "email.send",
			to: "user@example.com",
			subject: "Your sign-in code",
			ok: true,
		});
		expect(line).not.toContain("424242");
	});

	it("logs a structured failure line that carries no message body", async () => {
		await run(
			vi.fn<EmailTransport>().mockResolvedValue({
				ok: false,
				code: "PERMANENT_BOUNCE",
				message: "dead address",
				retryable: false,
			}),
		);

		const line = vi.mocked(console.error).mock.calls.flat().join("\n");
		expect(JSON.parse(line)).toMatchObject({
			event: "email.send",
			ok: false,
			code: "PERMANENT_BOUNCE",
		});
		expect(line).not.toContain("424242");
		expect(line).not.toContain("<p>");
	});
});

describe("emailConfigFromEnv", () => {
	it("defaults to the log provider when nothing is configured", () => {
		expect(emailConfigFromEnv()).toMatchObject({
			provider: "log",
			from: "noreply@example.invalid",
			fromName: "Dream Auth",
		});
	});
});
