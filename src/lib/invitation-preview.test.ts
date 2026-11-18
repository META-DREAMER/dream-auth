import { describe, expect, it } from "vitest";
import {
	type InvitationPreviewRow,
	toInvitationPreview,
} from "./invitation-preview";

const NOW = new Date("2026-11-17T12:00:00Z");

function row(overrides: Partial<InvitationPreviewRow> = {}) {
	return {
		email: "invitee@example.com",
		status: "pending",
		expiresAt: new Date("2026-11-20T00:00:00Z"),
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
});
