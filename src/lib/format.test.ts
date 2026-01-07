import { describe, expect, it } from "vitest";
import { formatAddress, formatDate, formatDateLong } from "./format";

describe("formatDate", () => {
	it("formats Date object correctly", () => {
		// Use noon UTC to avoid timezone day shifts
		const date = new Date("2024-01-15T12:00:00.000Z");
		const result = formatDate(date);
		// en-US short format: "Jan 15, 2024"
		expect(result).toContain("Jan");
		expect(result).toContain("2024");
	});

	it("formats date string correctly", () => {
		// Use noon to avoid timezone issues
		const result = formatDate("2024-06-20T12:00:00.000Z");
		expect(result).toContain("Jun");
		expect(result).toContain("2024");
	});

	it("formats ISO date string correctly", () => {
		const result = formatDate("2024-12-25T12:00:00.000Z");
		expect(result).toContain("Dec");
		expect(result).toContain("2024");
	});

	it("returns string in expected format", () => {
		const result = formatDate("2024-06-15T12:00:00.000Z");
		// Should be in format like "Jun 15, 2024"
		expect(result).toMatch(/[A-Z][a-z]{2} \d{1,2}, \d{4}/);
	});
});

describe("formatDateLong", () => {
	it("formats Date object with long month name", () => {
		// Use noon UTC to avoid timezone day shifts
		const date = new Date("2024-01-15T12:00:00.000Z");
		const result = formatDateLong(date);
		// en-US long format: "January 15, 2024"
		expect(result).toContain("January");
		expect(result).toContain("2024");
	});

	it("formats date string with long month name", () => {
		// Use noon to avoid timezone issues
		const result = formatDateLong("2024-06-20T12:00:00.000Z");
		expect(result).toContain("June");
		expect(result).toContain("2024");
	});

	it("returns string in expected format", () => {
		const result = formatDateLong("2024-06-15T12:00:00.000Z");
		// Should be in format like "June 15, 2024"
		expect(result).toMatch(/[A-Z][a-z]+ \d{1,2}, \d{4}/);
	});
});

describe("formatAddress", () => {
	it("formats full Ethereum address correctly", () => {
		const address = "0x1234567890abcdef1234567890abcdef12345678";
		const result = formatAddress(address);
		expect(result).toBe("0x1234...5678");
	});

	it("shows first 6 characters", () => {
		const address = "0xABCDEF1234567890ABCDEF1234567890ABCDEF12";
		const result = formatAddress(address);
		expect(result.startsWith("0xABCD")).toBe(true);
	});

	it("shows last 4 characters", () => {
		const address = "0x1234567890abcdef1234567890abcdef12345678";
		const result = formatAddress(address);
		expect(result.endsWith("5678")).toBe(true);
	});

	it("returns empty string for null", () => {
		expect(formatAddress(null)).toBe("");
	});

	it("returns empty string for undefined", () => {
		expect(formatAddress(undefined)).toBe("");
	});

	it("returns empty string for empty string", () => {
		expect(formatAddress("")).toBe("");
	});

	it("handles short addresses (edge case)", () => {
		// For addresses shorter than 10 chars, still applies the same logic
		const result = formatAddress("0x123456");
		expect(result).toBe("0x1234...3456");
	});

	it("preserves case of address", () => {
		const mixedCase = "0xAbCdEf1234567890abcdef1234567890AbCdEf12";
		const result = formatAddress(mixedCase);
		expect(result).toBe("0xAbCd...Ef12");
	});
});
