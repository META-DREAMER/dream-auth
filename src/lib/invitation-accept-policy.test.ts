import { describe, expect, it } from "vitest";
import {
	invitationAcceptRefusal,
	invitationViewerState,
} from "./invitation-accept-policy";

const WALLET = "0x1234567890abcdef1234567890abcdef12345678";

describe("invitationAcceptRefusal", () => {
	it("lets a verified user accept an email invitation", async () => {
		expect(
			await invitationAcceptRefusal({
				invitationWalletAddress: null,
				userEmailVerified: true,
				siweAccountIds: async () => [],
			}),
		).toBeNull();
	});

	it("refuses an email invitation to an unverified email", async () => {
		// e.g. a wallet account that set its email to the invited address via
		// changeEmail without proving the mailbox.
		expect(
			await invitationAcceptRefusal({
				invitationWalletAddress: undefined,
				userEmailVerified: false,
				siweAccountIds: async () => [`${WALLET}:1`],
			}),
		).toMatch(/verify your email/i);
	});

	it("lets the invited wallet accept a wallet invitation without a verified email", async () => {
		expect(
			await invitationAcceptRefusal({
				invitationWalletAddress: WALLET.toUpperCase().replace("0X", "0x"),
				userEmailVerified: false,
				siweAccountIds: async () => [`${WALLET}:1`],
			}),
		).toBeNull();
	});

	it("refuses a wallet invitation without the invited wallet", async () => {
		expect(
			await invitationAcceptRefusal({
				invitationWalletAddress: WALLET,
				userEmailVerified: true,
				siweAccountIds: async () => [
					"0xfedcba9876543210fedcba9876543210fedcba98:1",
				],
			}),
		).toMatch(/invited wallet/);
	});
});

describe("invitationViewerState", () => {
	const emailInvite = { email: "invitee@example.com", walletAddress: null };
	const walletInvite = {
		email: `${WALLET}@auth.example.com`,
		walletAddress: WALLET,
	};

	it("is the invitee: verified user with the invited email", () => {
		expect(
			invitationViewerState({
				invitation: emailInvite,
				user: { email: "Invitee@Example.com", emailVerified: true },
				siweAccountIds: [],
			}),
		).toBe("invitee");
	});

	it("needs verification: the invited email, unproven", () => {
		expect(
			invitationViewerState({
				invitation: emailInvite,
				user: { email: "invitee@example.com", emailVerified: false },
				siweAccountIds: [],
			}),
		).toBe("unverified");
	});

	it("is someone else: a different email", () => {
		expect(
			invitationViewerState({
				invitation: emailInvite,
				user: { email: "other@example.com", emailVerified: true },
				siweAccountIds: [],
			}),
		).toBe("other-account");
	});

	it("is someone else on a wallet invitation without the invited wallet", () => {
		for (const user of [
			{ email: "invitee@example.com", emailVerified: true },
			{ email: `${WALLET}@auth.example.com`, emailVerified: false },
		]) {
			expect(
				invitationViewerState({
					invitation: walletInvite,
					user,
					siweAccountIds: ["0xfedcba9876543210fedcba9876543210fedcba98:1"],
				}),
			).toBe("other-account");
		}
	});

	it("flags a wallet linked to an account whose email isn't the invitation's", () => {
		expect(
			invitationViewerState({
				invitation: walletInvite,
				user: {
					email: `${WALLET}@siwe.placeholder.invalid`,
					emailVerified: false,
				},
				siweAccountIds: [`${WALLET}:1`],
			}),
		).toBe("wallet-account-mismatch");
	});

	it("is the invitee on a wallet invitation with the wallet and the address", () => {
		expect(
			invitationViewerState({
				invitation: walletInvite,
				user: { email: walletInvite.email, emailVerified: false },
				siweAccountIds: [`${WALLET}:1`],
			}),
		).toBe("invitee");
	});
});
