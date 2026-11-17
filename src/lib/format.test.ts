import { describe, expect, it } from "vitest";
import { formatDate, formatDateLong } from "./format";

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
