import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ pool: { query: vi.fn() } }));

import {
	collectWalletAddresses,
	invitationIdFromBody,
	isSignupAllowed,
	type PendingInvitationLookup,
	shouldSendSignInCode,
} from "./registration-gate";

const WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const OTHER_WALLET = "0xfedcba9876543210fedcba9876543210fedcba98";

function lookup(options: {
	emails?: string[];
	wallets?: string[];
	/** Invitation id per invited email; an email without one matches any id. */
	ids?: Record<string, string>;
}): PendingInvitationLookup {
	const emails = new Set((options.emails ?? []).map((e) => e.toLowerCase()));
	const wallets = new Set((options.wallets ?? []).map((w) => w.toLowerCase()));
	return {
		hasInvitationForEmail: async (email, invitationId) =>
			emails.has(email.toLowerCase()) &&
			(invitationId === undefined ||
				options.ids?.[email.toLowerCase()] === invitationId),
		hasInvitationForWallet: async (wallet) => wallets.has(wallet.toLowerCase()),
	};
}

describe("collectWalletAddresses", () => {
	it("extracts the wallet from the SIWE placeholder email", () => {
		expect(
			collectWalletAddresses({
				email: `${WALLET}@siwe.placeholder.invalid`,
			}),
		).toEqual([WALLET]);
	});

	it("extracts the wallet from a configured emailDomainName address", () => {
		expect(
			collectWalletAddresses({ email: `${WALLET}@wallets.example.com` }),
		).toEqual([WALLET]);
	});

	it("lowercases a checksummed address", () => {
		const checksummed = "0x1234567890ABCDEF1234567890abcdef12345678";
		expect(collectWalletAddresses({ email: `${checksummed}@x.test` })).toEqual([
			checksummed.toLowerCase(),
		]);
	});

	it("ignores an ordinary email address", () => {
		expect(collectWalletAddresses({ email: "someone@example.com" })).toEqual(
			[],
		);
	});

	it("handles a missing email", () => {
		expect(collectWalletAddresses({})).toEqual([]);
		expect(collectWalletAddresses({ email: null })).toEqual([]);
	});

	it("extracts the wallet from a signed ERC-4361 message", () => {
		const message = [
			"auth.example.com wants you to sign in with your Ethereum account:",
			WALLET,
			"",
			"Sign in with your Ethereum wallet",
			"",
			"URI: https://auth.example.com",
			"Version: 1",
			"Chain ID: 1",
			"Nonce: abcdef0123456789",
			"Issued At: 2026-09-22T00:00:00.000Z",
		].join("\n");

		expect(
			collectWalletAddresses({
				email: "real@example.com",
				requestBody: { message },
			}),
		).toEqual([WALLET]);
	});

	it("deduplicates the email and message sources", () => {
		const message = [
			"auth.example.com wants you to sign in with your Ethereum account:",
			WALLET,
			"",
			"URI: https://auth.example.com",
			"Version: 1",
			"Chain ID: 1",
			"Nonce: abcdef0123456789",
			"Issued At: 2026-09-22T00:00:00.000Z",
		].join("\n");

		expect(
			collectWalletAddresses({
				email: `${WALLET}@siwe.placeholder.invalid`,
				requestBody: { message },
			}),
		).toEqual([WALLET]);
	});

	it("ignores a request body that is not a SIWE message", () => {
		expect(
			collectWalletAddresses({ requestBody: { message: "hello world" } }),
		).toEqual([]);
		expect(collectWalletAddresses({ requestBody: { email: "a@b.c" } })).toEqual(
			[],
		);
		expect(collectWalletAddresses({ requestBody: "not an object" })).toEqual(
			[],
		);
	});
});

describe("isSignupAllowed", () => {
	it("allows any signup when public registration is enabled", async () => {
		await expect(
			isSignupAllowed({
				enableRegistration: true,
				email: "nobody@example.com",
				lookup: lookup({}),
			}),
		).resolves.toBe(true);
	});

	it("allows signup when a pending invitation matches the email", async () => {
		await expect(
			isSignupAllowed({
				enableRegistration: false,
				email: "Invited@Example.com",
				lookup: lookup({ emails: ["invited@example.com"] }),
			}),
		).resolves.toBe(true);
	});

	it("allows SIWE signup when a wallet invitation matches", async () => {
		await expect(
			isSignupAllowed({
				enableRegistration: false,
				email: `${WALLET}@siwe.placeholder.invalid`,
				walletAddresses: [WALLET],
				lookup: lookup({ wallets: [WALLET] }),
			}),
		).resolves.toBe(true);
	});

	it("matches a wallet invitation stored with checksum casing", async () => {
		await expect(
			isSignupAllowed({
				enableRegistration: false,
				walletAddresses: [WALLET],
				lookup: lookup({ wallets: [WALLET.toUpperCase()] }),
			}),
		).resolves.toBe(true);
	});

	it("blocks signup with no matching invitation", async () => {
		await expect(
			isSignupAllowed({
				enableRegistration: false,
				email: `${WALLET}@siwe.placeholder.invalid`,
				walletAddresses: [WALLET],
				lookup: lookup({
					emails: ["someone-else@example.com"],
					wallets: [OTHER_WALLET],
				}),
			}),
		).resolves.toBe(false);
	});

	it("blocks signup when nothing identifies the user", async () => {
		await expect(
			isSignupAllowed({ enableRegistration: false, lookup: lookup({}) }),
		).resolves.toBe(false);
	});

	it("does not consult the wallet lookup when the email already matched", async () => {
		const hasInvitationForWallet = vi.fn(async () => false);
		await expect(
			isSignupAllowed({
				enableRegistration: false,
				email: "invited@example.com",
				walletAddresses: [WALLET],
				lookup: {
					hasInvitationForEmail: async () => true,
					hasInvitationForWallet,
				},
			}),
		).resolves.toBe(true);
		expect(hasInvitationForWallet).not.toHaveBeenCalled();
	});

	describe("password sign-up (requireInvitationId)", () => {
		const invited = lookup({
			emails: ["invited@example.com"],
			ids: { "invited@example.com": "inv-1" },
		});

		it("allows the invited email with its invitation id", async () => {
			await expect(
				isSignupAllowed({
					enableRegistration: false,
					email: "Invited@Example.com",
					requireInvitationId: true,
					invitationId: "inv-1",
					lookup: invited,
				}),
			).resolves.toBe(true);
		});

		it("blocks the invited email without an invitation id", async () => {
			await expect(
				isSignupAllowed({
					enableRegistration: false,
					email: "invited@example.com",
					requireInvitationId: true,
					invitationId: null,
					lookup: invited,
				}),
			).resolves.toBe(false);
		});

		it("blocks the invited email with another invitation's id", async () => {
			await expect(
				isSignupAllowed({
					enableRegistration: false,
					email: "invited@example.com",
					requireInvitationId: true,
					invitationId: "inv-2",
					lookup: invited,
				}),
			).resolves.toBe(false);
		});

		it("ignores a wallet invitation for a password sign-up", async () => {
			await expect(
				isSignupAllowed({
					enableRegistration: false,
					email: `${WALLET}@example.com`,
					walletAddresses: [WALLET],
					requireInvitationId: true,
					invitationId: null,
					lookup: lookup({ wallets: [WALLET] }),
				}),
			).resolves.toBe(false);
		});

		it("blocks a valid id presented with a different email", async () => {
			await expect(
				isSignupAllowed({
					enableRegistration: false,
					email: "attacker@example.com",
					requireInvitationId: true,
					invitationId: "inv-1",
					lookup: invited,
				}),
			).resolves.toBe(false);
		});
	});
});

describe("shouldSendSignInCode", () => {
	const noUsers = async () => false;

	it("sends to anyone while public registration is on", async () => {
		const userExists = vi.fn(noUsers);
		await expect(
			shouldSendSignInCode({
				enableRegistration: true,
				email: "stranger@example.com",
				userExists,
				lookup: lookup({}),
			}),
		).resolves.toBe(true);
		expect(userExists).not.toHaveBeenCalled();
	});

	it("sends to an existing user", async () => {
		await expect(
			shouldSendSignInCode({
				enableRegistration: false,
				email: "member@example.com",
				userExists: async (email) => email === "member@example.com",
				lookup: lookup({}),
			}),
		).resolves.toBe(true);
	});

	it("sends to an address with a pending invitation", async () => {
		await expect(
			shouldSendSignInCode({
				enableRegistration: false,
				email: "Invited@Example.com",
				userExists: noUsers,
				lookup: lookup({ emails: ["invited@example.com"] }),
			}),
		).resolves.toBe(true);
	});

	it("does not need the invitation id: the code itself proves the mailbox", async () => {
		await expect(
			shouldSendSignInCode({
				enableRegistration: false,
				email: "invited@example.com",
				userExists: noUsers,
				lookup: lookup({
					emails: ["invited@example.com"],
					ids: { "invited@example.com": "inv-1" },
				}),
			}),
		).resolves.toBe(true);
	});

	it("does not send to a stranger", async () => {
		await expect(
			shouldSendSignInCode({
				enableRegistration: false,
				email: "stranger@example.com",
				userExists: noUsers,
				lookup: lookup({ emails: ["invited@example.com"] }),
			}),
		).resolves.toBe(false);
	});

	it("ignores wallet invitations: a wallet invitee signs in with the wallet", async () => {
		await expect(
			shouldSendSignInCode({
				enableRegistration: false,
				email: `${WALLET}@example.com`,
				userExists: noUsers,
				lookup: lookup({ wallets: [WALLET] }),
			}),
		).resolves.toBe(false);
	});
});

describe("invitationIdFromBody", () => {
	it("reads a non-empty string id", () => {
		expect(invitationIdFromBody({ invitationId: "abc" })).toBe("abc");
	});

	it("ignores a missing, empty or non-string id", () => {
		expect(invitationIdFromBody(undefined)).toBeNull();
		expect(invitationIdFromBody({})).toBeNull();
		expect(invitationIdFromBody({ invitationId: "" })).toBeNull();
		expect(invitationIdFromBody({ invitationId: 42 })).toBeNull();
	});
});
