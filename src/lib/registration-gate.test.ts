import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ pool: { query: vi.fn() } }));

import {
	isSignupAllowed,
	type PendingInvitationLookup,
	shouldSendSignInCode,
} from "./registration-gate";

function lookup(options: { emails?: string[] }): PendingInvitationLookup {
	const emails = new Set((options.emails ?? []).map((e) => e.toLowerCase()));
	return {
		hasInvitationForEmail: async (email) => emails.has(email.toLowerCase()),
	};
}

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

	it("blocks signup with no matching invitation", async () => {
		await expect(
			isSignupAllowed({
				enableRegistration: false,
				email: "stranger@example.com",
				lookup: lookup({ emails: ["someone-else@example.com"] }),
			}),
		).resolves.toBe(false);
	});

	it("blocks signup when nothing identifies the user", async () => {
		await expect(
			isSignupAllowed({ enableRegistration: false, lookup: lookup({}) }),
		).resolves.toBe(false);
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
});
