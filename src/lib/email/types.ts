/**
 * Outbound email primitives.
 *
 * A transport returns a result object instead of throwing so that callers can
 * tell a dead recipient (`retryable: false`) apart from a provider outage
 * (`retryable: true`). Auth flows react differently to the two.
 */

export type SendEmailInput = {
	to: string;
	subject: string;
	html: string;
	text: string;
};

export type SendEmailResult =
	| { ok: true; messageId?: string }
	| { ok: false; code: string; message: string; retryable: boolean };

export type EmailTransport = (
	input: SendEmailInput,
) => Promise<SendEmailResult>;

/** Everything a transport needs, resolved from the environment. */
export type EmailConfig = {
	provider: "log" | "cloudflare";
	from: string;
	fromName: string;
	accountId?: string;
	apiToken?: string;
};

/** A rendered email, produced by the template functions. */
export type EmailTemplate = {
	subject: string;
	html: string;
	text: string;
};
