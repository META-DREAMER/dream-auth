import { serverEnv } from "@/env";
import { createTransport } from "@/lib/email/transport";
import type {
	EmailConfig,
	EmailTransport,
	SendEmailInput,
	SendEmailResult,
} from "@/lib/email/types";

/**
 * Auth flows are interactive: a second attempt is worth the latency, a third
 * is not.
 */
const RETRY_DELAY_MS = 500;

export function emailConfigFromEnv(): EmailConfig {
	return {
		provider: serverEnv.EMAIL_PROVIDER,
		from: serverEnv.EMAIL_FROM,
		fromName: serverEnv.EMAIL_FROM_NAME,
		accountId: serverEnv.CLOUDFLARE_ACCOUNT_ID,
		apiToken: serverEnv.CLOUDFLARE_API_TOKEN,
	};
}

let cachedTransport: EmailTransport | null = null;

function defaultTransport(): EmailTransport {
	cachedTransport ??= createTransport(emailConfigFromEnv());
	return cachedTransport;
}

const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The one email primitive. Retries once on a transient failure, never on a
 * permanent one, and logs a structured line for every outcome.
 *
 * The log line carries `to`, `subject` and the result code only — never the
 * body, which is where OTP codes and invitation links live.
 */
export async function sendEmail(
	input: SendEmailInput,
	options: { transport?: EmailTransport } = {},
): Promise<SendEmailResult> {
	const transport = options.transport ?? defaultTransport();

	let result = await transport(input);

	if (!result.ok && result.retryable) {
		await sleep(RETRY_DELAY_MS);
		result = await transport(input);
	}

	if (result.ok) {
		console.log(
			JSON.stringify({
				event: "email.send",
				to: input.to,
				subject: input.subject,
				ok: true,
			}),
		);
	} else {
		console.error(
			JSON.stringify({
				event: "email.send",
				to: input.to,
				subject: input.subject,
				ok: false,
				code: result.code,
				message: result.message,
			}),
		);
	}

	return result;
}

/** Test seam: drop the memoised transport so the next send re-reads config. */
export function resetEmailTransport(): void {
	cachedTransport = null;
}
