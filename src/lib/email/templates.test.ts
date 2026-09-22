import { describe, expect, it } from "vitest";
import {
	escapeHtml,
	type OtpType,
	orgInvitationEmail,
	otpEmail,
	verificationEmail,
	walletInvitationEmail,
} from "@/lib/email/templates";

const INVITE_FIELDS = {
	orgName: "Dream Org",
	inviterEmail: "admin@example.com",
	role: "member",
	inviteLink: "https://auth.example.com/invite/inv-123",
};

describe("escapeHtml", () => {
	it("escapes every HTML-significant character", () => {
		expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
			"&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;",
		);
	});
});

describe("verificationEmail", () => {
	it("returns a non-empty subject, html and text", () => {
		const template = verificationEmail({
			url: "https://example.com/verify?t=1",
		});
		expect(template.subject).toBe("Confirm your email address");
		expect(template.html.length).toBeGreaterThan(0);
		expect(template.text.length).toBeGreaterThan(0);
	});

	it("includes the verification URL in both bodies", () => {
		const url = "https://example.com/verify?token=abc";
		const template = verificationEmail({ url });
		// The html body escapes the ampersand-free URL verbatim.
		expect(template.html).toContain(url);
		expect(template.text).toContain(url);
	});
});

describe("otpEmail", () => {
	const cases: Array<[OtpType, string]> = [
		["sign-in", "Your sign-in code"],
		["email-verification", "Verify your email"],
		["forget-password", "Reset your password"],
	];

	it.each(cases)("uses the right subject for type %s", (type, subject) => {
		expect(otpEmail({ otp: "123456", type }).subject).toBe(subject);
	});

	it.each(cases)("renders the code for type %s", (type) => {
		const template = otpEmail({ otp: "918273", type });
		expect(template.html).toContain("918273");
		expect(template.text).toContain("918273");
	});

	it("never leaves the subject line carrying the code", () => {
		expect(otpEmail({ otp: "424242", type: "sign-in" }).subject).not.toContain(
			"424242",
		);
	});

	it("falls back to the sign-in copy for an unknown type", () => {
		const template = otpEmail({
			otp: "111111",
			type: "something-new" as OtpType,
		});
		expect(template.subject).toBe("Your sign-in code");
		expect(template.text).toContain("111111");
	});
});

describe("orgInvitationEmail", () => {
	it("names the org, the inviter and the role", () => {
		const template = orgInvitationEmail(INVITE_FIELDS);
		expect(template.subject).toContain("Dream Org");
		for (const body of [template.html, template.text]) {
			expect(body).toContain("Dream Org");
			expect(body).toContain("admin@example.com");
			expect(body).toContain("member");
			expect(body).toContain(INVITE_FIELDS.inviteLink);
		}
	});

	it("escapes a hostile organization name in the html body", () => {
		const template = orgInvitationEmail({
			...INVITE_FIELDS,
			orgName: "<script>alert(1)</script>",
		});
		expect(template.html).not.toContain("<script>");
		expect(template.html).toContain("&lt;script&gt;");
	});

	it("escapes a hostile inviter address in the html body", () => {
		const template = orgInvitationEmail({
			...INVITE_FIELDS,
			inviterEmail: '"><img src=x onerror=alert(1)>',
		});
		expect(template.html).not.toContain("<img");
	});
});

describe("walletInvitationEmail", () => {
	const wallet = "0xabcdef0123456789abcdef0123456789abcdef01";

	it("carries the invite link and the wallet address in both bodies", () => {
		const template = walletInvitationEmail({
			...INVITE_FIELDS,
			walletAddress: wallet,
		});
		for (const body of [template.html, template.text]) {
			expect(body).toContain(INVITE_FIELDS.inviteLink);
			expect(body).toContain(wallet);
		}
	});

	it("states the wallet constraint in the text body", () => {
		const template = walletInvitationEmail({
			...INVITE_FIELDS,
			walletAddress: wallet,
		});
		expect(template.text).toContain("sign in with this wallet");
	});
});
