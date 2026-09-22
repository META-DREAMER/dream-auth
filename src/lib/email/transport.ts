import type {
	EmailConfig,
	EmailTransport,
	SendEmailInput,
	SendEmailResult,
} from "@/lib/email/types";

/** A hung provider call must never wedge an interactive auth request. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Development transport. Sends nothing.
 *
 * It prints the body only outside production: the body of an OTP or invitation
 * email contains a credential, and pod logs are not a place for those. In
 * production it prints a single structured line with no body.
 */
export const logTransport: EmailTransport = async (input) => {
	if (process.env.NODE_ENV === "production") {
		console.log(
			JSON.stringify({
				event: "email.send",
				transport: "log",
				to: input.to,
				subject: input.subject,
				ok: true,
				note: "EMAIL_PROVIDER=log, nothing was sent",
			}),
		);
		return { ok: true };
	}

	console.log(
		`\n[email:log] to=${input.to}\n[email:log] subject=${input.subject}\n${input.text}\n`,
	);
	return { ok: true };
};

type CloudflareSendResponse = {
	success?: boolean;
	errors?: Array<{ code?: number | string; message?: string }>;
	result?: {
		delivered?: string[];
		permanent_bounces?: string[];
		queued?: string[];
	};
};

function firstError(body: CloudflareSendResponse | null): {
	code: string;
	message: string;
} {
	const error = body?.errors?.[0];
	return {
		code: error?.code !== undefined ? String(error.code) : "UNKNOWN",
		message: error?.message ?? "Cloudflare Email Sending returned an error.",
	};
}

/**
 * Cloudflare Email Sending, REST API.
 *
 * POST /accounts/{account_id}/email/sending/send
 *
 * Note the field names: the REST API takes `from: { address, name }` and
 * snake_case `reply_to`. The Workers `send_email` binding takes `from.email`
 * and `replyTo` — copying an example from the binding docs will fail here.
 */
export function createCloudflareTransport(config: {
	accountId: string;
	apiToken: string;
	from: string;
	fromName: string;
}): EmailTransport {
	const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`;

	return async (input: SendEmailInput): Promise<SendEmailResult> => {
		let response: Response;

		try {
			response = await fetch(url, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${config.apiToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					to: input.to,
					from: { address: config.from, name: config.fromName },
					subject: input.subject,
					html: input.html,
					text: input.text,
				}),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch (error) {
			// Network failure, DNS failure or the 10s timeout. Worth one retry.
			return {
				ok: false,
				code: "NETWORK_ERROR",
				message:
					error instanceof Error ? error.message : "Network request failed.",
				retryable: true,
			};
		}

		let body: CloudflareSendResponse | null = null;
		try {
			body = (await response.json()) as CloudflareSendResponse;
		} catch {
			body = null;
		}

		if (!response.ok) {
			const { code, message } = firstError(body);
			// 429 and 5xx are transient. Everything else needs the request fixed
			// (bad token, unverified sender, suppressed recipient).
			const retryable = response.status === 429 || response.status >= 500;
			return {
				ok: false,
				code: `HTTP_${response.status}${code === "UNKNOWN" ? "" : `:${code}`}`,
				message,
				retryable,
			};
		}

		const result = body?.result;
		const bounced = result?.permanent_bounces ?? [];
		if (bounced.length > 0) {
			return {
				ok: false,
				code: "PERMANENT_BOUNCE",
				message: "That email address could not be reached.",
				retryable: false,
			};
		}

		const accepted =
			(result?.delivered?.length ?? 0) + (result?.queued?.length ?? 0);
		if (accepted === 0) {
			const { code, message } = firstError(body);
			return {
				ok: false,
				code: code === "UNKNOWN" ? "NO_RECIPIENTS_ACCEPTED" : code,
				message,
				retryable: false,
			};
		}

		return { ok: true };
	};
}

/**
 * Pick a transport from resolved config.
 *
 * `cloudflare` without credentials falls back to `log` rather than throwing —
 * `src/env.ts` already rejects that combination at startup, so this is a
 * belt-and-braces guard that keeps a misconfigured pod serving instead of
 * crash-looping.
 */
export function createTransport(config: EmailConfig): EmailTransport {
	if (config.provider !== "cloudflare") return logTransport;

	if (!config.accountId || !config.apiToken) {
		console.error(
			JSON.stringify({
				event: "email.transport",
				ok: false,
				code: "MISSING_CREDENTIALS",
				message:
					"EMAIL_PROVIDER=cloudflare but CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN are unset; falling back to the log transport.",
			}),
		);
		return logTransport;
	}

	return createCloudflareTransport({
		accountId: config.accountId,
		apiToken: config.apiToken,
		from: config.from,
		fromName: config.fromName,
	});
}
