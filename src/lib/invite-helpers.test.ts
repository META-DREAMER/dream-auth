import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock client dependencies before importing
vi.mock("@/env.client", () => ({
	clientEnv: {
		VITE_AUTH_URL: "https://auth.example.com",
	},
}));

vi.mock("@/lib/auth-client", () => ({
	organization: {
		inviteMember: vi.fn(),
	},
}));

// Mock window.location for tests
const mockLocation = {
	origin: "https://localhost:3000",
	host: "localhost:3000",
};

vi.stubGlobal("window", { location: mockLocation });

import { organization } from "@/lib/auth-client";
import {
	getInvitationWalletAddress,
	getWalletEmail,
	inviteByEmail,
	inviteByWallet,
	isWalletInvitation,
} from "./invite-helpers";

describe("getWalletEmail", () => {
	it("generates email from wallet address using auth URL domain", () => {
		const email = getWalletEmail("0xABC123DEF456789012345678901234567890ABCD");

		expect(email).toBe(
			"0xabc123def456789012345678901234567890abcd@auth.example.com",
		);
	});

	it("lowercases the wallet address", () => {
		const email = getWalletEmail("0xABCDEF1234567890ABCDEF1234567890ABCDEF12");

		expect(email.startsWith("0xabcdef")).toBe(true);
	});

	it("preserves the domain from VITE_AUTH_URL", () => {
		const email = getWalletEmail("0x1234567890123456789012345678901234567890");

		expect(email.endsWith("@auth.example.com")).toBe(true);
	});
});

describe("isWalletInvitation", () => {
	it("returns true when walletAddress is set", () => {
		expect(isWalletInvitation({ walletAddress: "0x123" })).toBe(true);
	});

	it("returns false when walletAddress is null", () => {
		expect(isWalletInvitation({ walletAddress: null })).toBe(false);
	});

	it("returns false when walletAddress is undefined", () => {
		expect(isWalletInvitation({})).toBe(false);
	});

	it("returns false when walletAddress is empty string", () => {
		expect(isWalletInvitation({ walletAddress: "" })).toBe(false);
	});

	it("returns true for valid Ethereum address", () => {
		expect(
			isWalletInvitation({
				walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
			}),
		).toBe(true);
	});
});

describe("getInvitationWalletAddress", () => {
	it("returns wallet address when present", () => {
		const result = getInvitationWalletAddress({ walletAddress: "0xABC" });
		expect(result).toBe("0xABC");
	});

	it("returns null when walletAddress is null", () => {
		const result = getInvitationWalletAddress({ walletAddress: null });
		expect(result).toBeNull();
	});

	it("returns null when walletAddress is undefined", () => {
		const result = getInvitationWalletAddress({});
		expect(result).toBeNull();
	});

	it("returns null when walletAddress is empty string", () => {
		const result = getInvitationWalletAddress({ walletAddress: "" });
		expect(result).toBeNull();
	});

	it("returns full address", () => {
		const address = "0x1234567890abcdef1234567890abcdef12345678";
		const result = getInvitationWalletAddress({ walletAddress: address });
		expect(result).toBe(address);
	});
});

describe("inviteByWallet", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls organization.inviteMember with correct parameters", async () => {
		vi.mocked(organization.inviteMember).mockResolvedValue({} as never);

		await inviteByWallet(
			"0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
			"member",
			"org-123",
		);

		expect(organization.inviteMember).toHaveBeenCalledWith({
			email: "0xabcdef1234567890abcdef1234567890abcdef12@auth.example.com",
			role: "member",
			organizationId: "org-123",
			walletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
		});
	});

	it("lowercases wallet address in both email and walletAddress", async () => {
		vi.mocked(organization.inviteMember).mockResolvedValue({} as never);

		await inviteByWallet(
			"0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
			"admin",
			"org-456",
		);

		const call = vi.mocked(organization.inviteMember).mock.calls[0][0];
		expect(call.walletAddress).toBe(
			"0xabcdef1234567890abcdef1234567890abcdef12",
		);
		expect(call.email.startsWith("0xabcdef")).toBe(true);
	});

	it("supports all role types", async () => {
		vi.mocked(organization.inviteMember).mockResolvedValue({} as never);

		await inviteByWallet(
			"0x1234567890123456789012345678901234567890",
			"member",
			"org-1",
		);
		await inviteByWallet(
			"0x1234567890123456789012345678901234567890",
			"admin",
			"org-2",
		);
		await inviteByWallet(
			"0x1234567890123456789012345678901234567890",
			"owner",
			"org-3",
		);

		expect(organization.inviteMember).toHaveBeenCalledTimes(3);
	});
});

describe("inviteByEmail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls organization.inviteMember with correct parameters", async () => {
		vi.mocked(organization.inviteMember).mockResolvedValue({} as never);

		await inviteByEmail("User@Example.com", "member", "org-123");

		expect(organization.inviteMember).toHaveBeenCalledWith({
			email: "user@example.com",
			role: "member",
			organizationId: "org-123",
			walletAddress: undefined,
		});
	});

	it("lowercases the email address", async () => {
		vi.mocked(organization.inviteMember).mockResolvedValue({} as never);

		await inviteByEmail("USER@EXAMPLE.COM", "admin", "org-456");

		const call = vi.mocked(organization.inviteMember).mock.calls[0][0];
		expect(call.email).toBe("user@example.com");
	});

	it("sets walletAddress to undefined for email invitations", async () => {
		vi.mocked(organization.inviteMember).mockResolvedValue({} as never);

		await inviteByEmail("test@example.com", "member", "org-789");

		const call = vi.mocked(organization.inviteMember).mock.calls[0][0];
		expect(call.walletAddress).toBeUndefined();
	});

	it("supports all role types", async () => {
		vi.mocked(organization.inviteMember).mockResolvedValue({} as never);

		await inviteByEmail("test@example.com", "member", "org-1");
		await inviteByEmail("test@example.com", "admin", "org-2");
		await inviteByEmail("test@example.com", "owner", "org-3");

		expect(organization.inviteMember).toHaveBeenCalledTimes(3);
	});
});
