import { describe, expect, it } from "vitest";
import {
	type InvitationPreviewRow,
	toInvitationPreview,
} from "./invitation-preview";

const NOW = new Date("2026-11-17T12:00:00Z");
const WALLET = "0x1234567890abcdef1234567890abcdef12345678";

function row(overrides: Partial<InvitationPreviewRow> = {}) {
	return {
		email: "invitee@example.com",
		status: "pending",
		expiresAt: new Date("2026-11-20T00:00:00Z"),
		walletAddress: null,
		organizationName: "Home",
		inviterName: "Owner",
		...overrides,
	} satisfies InvitationPreviewRow;
}

describe("toInvitationPreview", () => {
	it("gives a pending invitation's email, organization and inviter name", () => {
		expect(toInvitationPreview(row(), NOW)).toEqual({
			state: "pending",
			email: "invitee@example.com",
			organizationName: "Home",
			inviterName: "Owner",
			walletAddressPreview: null,
		});
	});

	it("returns exactly those fields, nothing else from the row", () => {
		const preview = toInvitationPreview(
			{ ...row(), role: "admin", inviterEmail: "o@x" } as InvitationPreviewRow,
			NOW,
		);
		expect(Object.keys(preview).sort()).toEqual([
			"email",
			"inviterName",
			"organizationName",
			"state",
			"walletAddressPreview",
		]);
	});

	it("reports a missing invitation as not found", () => {
		expect(toInvitationPreview(undefined, NOW)).toEqual({
			state: "not-found",
		});
	});

	it.each([
		"accepted",
		"rejected",
		"canceled",
	])("reveals nothing but the state for a %s invitation", (status) => {
		expect(toInvitationPreview(row({ status }), NOW)).toEqual({
			state: "used",
		});
	});

	it("reveals nothing but the state for an expired invitation", () => {
		expect(
			toInvitationPreview(row({ expiresAt: "2026-11-17T12:00:00Z" }), NOW),
		).toEqual({ state: "expired" });
	});

	it("treats a blank inviter name as none", () => {
		const preview = toInvitationPreview(row({ inviterName: "  " }), NOW);
		expect(preview).toMatchObject({ inviterName: null });
	});

	it("keeps a wallet invitation's derived address out, masking the wallet", () => {
		const preview = toInvitationPreview(
			row({ email: `${WALLET}@auth.example.com`, walletAddress: WALLET }),
			NOW,
		);
		expect(preview).toEqual({
			state: "pending",
			email: null,
			organizationName: "Home",
			inviterName: "Owner",
			walletAddressPreview: "0x1234...5678",
		});
	});
});
