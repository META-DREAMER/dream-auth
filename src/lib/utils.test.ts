import { describe, expect, it } from "vitest";
import { getRealEmail, isSiweGeneratedEmail } from "./utils";

// Note: cn() is not tested as it's a simple wrapper around clsx/tailwind-merge

describe("isSiweGeneratedEmail", () => {
	it("returns true for valid SIWE-generated email", () => {
		// Standard Ethereum address format: 0x + 40 hex characters
		expect(
			isSiweGeneratedEmail(
				"0x1234567890abcdef1234567890abcdef12345678@example.com",
			),
		).toBe(true);
	});

	it("returns true for uppercase hex in SIWE email", () => {
		expect(
			isSiweGeneratedEmail(
				"0xABCDEF1234567890ABCDEF1234567890ABCDEF12@example.com",
			),
		).toBe(true);
	});

	it("returns true for mixed case hex in SIWE email", () => {
		expect(
			isSiweGeneratedEmail(
				"0xAbCdEf1234567890abCDef1234567890AbCdEf12@example.com",
			),
		).toBe(true);
	});

	it("returns false for regular email", () => {
		expect(isSiweGeneratedEmail("user@example.com")).toBe(false);
	});

	it("returns false for email starting with 0x but not 40 hex chars", () => {
		// Only 38 hex characters
		expect(
			isSiweGeneratedEmail(
				"0x123456789012345678901234567890123456@example.com",
			),
		).toBe(false);
	});

	it("returns false for email with 0x in domain only", () => {
		expect(isSiweGeneratedEmail("user@0x1234.com")).toBe(false);
	});

	it("returns false for null", () => {
		expect(isSiweGeneratedEmail(null)).toBe(false);
	});

	it("returns false for undefined", () => {
		expect(isSiweGeneratedEmail(undefined)).toBe(false);
	});

	it("returns false for empty string", () => {
		expect(isSiweGeneratedEmail("")).toBe(false);
	});

	it("returns false for email with invalid hex characters", () => {
		// Contains 'g' which is not a valid hex character
		expect(
			isSiweGeneratedEmail(
				"0x123456789g123456789012345678901234567890@example.com",
			),
		).toBe(false);
	});

	it("returns true regardless of domain", () => {
		expect(
			isSiweGeneratedEmail(
				"0x1234567890abcdef1234567890abcdef12345678@any-domain.org",
			),
		).toBe(true);
		expect(
			isSiweGeneratedEmail(
				"0x1234567890abcdef1234567890abcdef12345678@localhost:3000",
			),
		).toBe(true);
	});
});

describe("getRealEmail", () => {
	it("returns the email for regular email addresses", () => {
		expect(getRealEmail("user@example.com")).toBe("user@example.com");
	});

	it("returns null for SIWE-generated email", () => {
		expect(
			getRealEmail("0x1234567890abcdef1234567890abcdef12345678@example.com"),
		).toBe(null);
	});

	it("returns null for null input", () => {
		expect(getRealEmail(null)).toBe(null);
	});

	it("returns null for undefined input", () => {
		expect(getRealEmail(undefined)).toBe(null);
	});

	it("returns null for empty string", () => {
		expect(getRealEmail("")).toBe(null);
	});

	it("preserves email case", () => {
		expect(getRealEmail("User@Example.COM")).toBe("User@Example.COM");
	});

	it("handles email with plus sign", () => {
		expect(getRealEmail("user+tag@example.com")).toBe("user+tag@example.com");
	});

	it("handles email with dots", () => {
		expect(getRealEmail("first.last@example.com")).toBe(
			"first.last@example.com",
		);
	});
});
