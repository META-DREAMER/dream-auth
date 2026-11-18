import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
	organization: {
		inviteMember: vi.fn(),
	},
}));

import { organization } from "@/lib/auth-client";
import { inviteByEmail } from "./invite-helpers";

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
		});
	});

	it("lowercases the email address", async () => {
		vi.mocked(organization.inviteMember).mockResolvedValue({} as never);

		await inviteByEmail("USER@EXAMPLE.COM", "admin", "org-456");

		const call = vi.mocked(organization.inviteMember).mock.calls[0][0];
		expect(call.email).toBe("user@example.com");
	});

	it("supports all role types", async () => {
		vi.mocked(organization.inviteMember).mockResolvedValue({} as never);

		await inviteByEmail("test@example.com", "member", "org-1");
		await inviteByEmail("test@example.com", "admin", "org-2");
		await inviteByEmail("test@example.com", "owner", "org-3");

		expect(organization.inviteMember).toHaveBeenCalledTimes(3);
	});
});
