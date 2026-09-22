import type { EmailTemplate } from "@/lib/email/types";

/**
 * Plain template literals, no template engine. Every template ships both `html`
 * and `text`: an HTML-only message costs deliverability points with most spam
 * filters, and some clients render the text part only.
 */

/** Escape user-controlled values before they land in the HTML body. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function layout(bodyHtml: string): string {
	return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px;">
<tr><td>
${bodyHtml}
<p style="margin:32px 0 0;font-size:12px;line-height:18px;color:#71717a;">
If you were not expecting this email you can safely ignore it.
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(href: string, label: string): string {
	return `<p style="margin:24px 0;">
<a href="${escapeHtml(href)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">${escapeHtml(label)}</a>
</p>
<p style="margin:0;font-size:13px;line-height:20px;color:#52525b;">
Or paste this link into your browser:<br />
<span style="word-break:break-all;">${escapeHtml(href)}</span>
</p>`;
}

/** Email-change / email-verification link. */
export function verificationEmail({ url }: { url: string }): EmailTemplate {
	return {
		subject: "Confirm your email address",
		html: layout(
			`<h1 style="margin:0 0 16px;font-size:20px;line-height:28px;">Confirm your email address</h1>
<p style="margin:0;font-size:15px;line-height:24px;">Click the button below to confirm this address. The link expires in one hour.</p>
${button(url, "Confirm email address")}`,
		),
		text: [
			"Confirm your email address",
			"",
			"Open this link to confirm this address. It expires in one hour.",
			url,
			"",
			"If you were not expecting this email you can safely ignore it.",
		].join("\n"),
	};
}

export type OtpType = "sign-in" | "email-verification" | "forget-password";

const OTP_COPY: Record<
	OtpType,
	{ subject: string; heading: string; lead: string }
> = {
	"sign-in": {
		subject: "Your sign-in code",
		heading: "Your sign-in code",
		lead: "Enter this code to finish signing in.",
	},
	"email-verification": {
		subject: "Verify your email",
		heading: "Verify your email",
		lead: "Enter this code to verify your email address.",
	},
	"forget-password": {
		subject: "Reset your password",
		heading: "Reset your password",
		lead: "Enter this code to choose a new password.",
	},
};

/** One-time code. Subject and copy vary across the three better-auth OTP types. */
export function otpEmail({
	otp,
	type,
}: {
	otp: string;
	type: OtpType;
}): EmailTemplate {
	const copy = OTP_COPY[type] ?? OTP_COPY["sign-in"];

	return {
		subject: copy.subject,
		html: layout(
			`<h1 style="margin:0 0 16px;font-size:20px;line-height:28px;">${escapeHtml(copy.heading)}</h1>
<p style="margin:0;font-size:15px;line-height:24px;">${escapeHtml(copy.lead)}</p>
<p style="margin:24px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;line-height:40px;letter-spacing:6px;font-weight:700;">${escapeHtml(otp)}</p>
<p style="margin:0;font-size:13px;line-height:20px;color:#52525b;">This code expires shortly. Do not share it with anyone.</p>`,
		),
		text: [
			copy.heading,
			"",
			copy.lead,
			"",
			otp,
			"",
			"This code expires shortly. Do not share it with anyone.",
		].join("\n"),
	};
}

type InvitationFields = {
	orgName: string;
	inviterEmail: string;
	role: string;
	inviteLink: string;
};

/** Organization invitation, email-based. */
export function orgInvitationEmail({
	orgName,
	inviterEmail,
	role,
	inviteLink,
}: InvitationFields): EmailTemplate {
	return {
		subject: `You have been invited to ${orgName}`,
		html: layout(
			`<h1 style="margin:0 0 16px;font-size:20px;line-height:28px;">You have been invited to ${escapeHtml(orgName)}</h1>
<p style="margin:0;font-size:15px;line-height:24px;">
<strong>${escapeHtml(inviterEmail)}</strong> invited you to join <strong>${escapeHtml(orgName)}</strong> as <strong>${escapeHtml(role)}</strong>.
</p>
${button(inviteLink, "Accept invitation")}
<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#52525b;">This invitation expires in 7 days.</p>`,
		),
		text: [
			`You have been invited to ${orgName}`,
			"",
			`${inviterEmail} invited you to join ${orgName} as ${role}.`,
			"",
			"Accept the invitation:",
			inviteLink,
			"",
			"This invitation expires in 7 days.",
		].join("\n"),
	};
}

/** Organization invitation bound to a specific wallet (accepted via SIWE). */
export function walletInvitationEmail({
	orgName,
	inviterEmail,
	role,
	inviteLink,
	walletAddress,
}: InvitationFields & { walletAddress: string }): EmailTemplate {
	return {
		subject: `You have been invited to ${orgName}`,
		html: layout(
			`<h1 style="margin:0 0 16px;font-size:20px;line-height:28px;">You have been invited to ${escapeHtml(orgName)}</h1>
<p style="margin:0;font-size:15px;line-height:24px;">
<strong>${escapeHtml(inviterEmail)}</strong> invited you to join <strong>${escapeHtml(orgName)}</strong> as <strong>${escapeHtml(role)}</strong>.
</p>
<p style="margin:16px 0 0;font-size:15px;line-height:24px;">
To accept, sign in with this wallet:<br />
<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;">${escapeHtml(walletAddress)}</span>
</p>
${button(inviteLink, "Accept invitation")}
<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#52525b;">This invitation expires in 7 days.</p>`,
		),
		text: [
			`You have been invited to ${orgName}`,
			"",
			`${inviterEmail} invited you to join ${orgName} as ${role}.`,
			"",
			`To accept, sign in with this wallet: ${walletAddress}`,
			"",
			"Accept the invitation:",
			inviteLink,
			"",
			"This invitation expires in 7 days.",
		].join("\n"),
	};
}
