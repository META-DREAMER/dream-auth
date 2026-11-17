import { describe, expect, it } from "vitest";
import { invitationAcceptRefusal } from "./invitation-accept-policy";

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
