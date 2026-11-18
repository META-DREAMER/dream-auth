import { describe, expect, it } from "vitest";
import {
	invitationAcceptRefusal,
	invitationViewerState,
} from "./invitation-accept-policy";

describe("invitationAcceptRefusal", () => {
	it("lets a verified user accept", () => {
		expect(invitationAcceptRefusal({ userEmailVerified: true })).toBeNull();
	});

	it("refuses an unverified email", () => {
		// e.g. an account that set its email to the invited address via
		// changeEmail without proving the mailbox.
		expect(invitationAcceptRefusal({ userEmailVerified: false })).toMatch(
			/verify your email/i,
		);
	});
});

describe("invitationViewerState", () => {
	const invitation = { email: "invitee@example.com" };

	it("is the invitee: verified user with the invited email", () => {
		expect(
			invitationViewerState({
				invitation,
				user: { email: "Invitee@Example.com", emailVerified: true },
			}),
		).toBe("invitee");
	});

	it("needs verification: the invited email, unproven", () => {
		expect(
			invitationViewerState({
				invitation,
				user: { email: "invitee@example.com", emailVerified: false },
			}),
		).toBe("unverified");
	});

	it("is someone else: a different email", () => {
		expect(
			invitationViewerState({
				invitation,
				user: { email: "other@example.com", emailVerified: true },
			}),
		).toBe("other-account");
	});
});
