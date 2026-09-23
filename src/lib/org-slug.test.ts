import { describe, expect, it } from "vitest";
import { isValidOrgSlug } from "./org-slug";

describe("isValidOrgSlug", () => {
	it.each([
		"home",
		"lab-2",
		"a",
		"0",
		"my-org-name",
		"-leading",
		"trailing-",
		"a--b",
	])("accepts %j", (slug) => {
		expect(isValidOrgSlug(slug)).toBe(true);
	});

	it.each([
		"home:role:admin",
		"home:team:media",
		":",
		"Home",
		"home org",
		"home_org",
		"home.org",
		"hömë",
		"",
		"home\n",
	])("rejects %j", (slug) => {
		expect(isValidOrgSlug(slug)).toBe(false);
	});

	it("rejects non-strings", () => {
		expect(isValidOrgSlug(undefined)).toBe(false);
		expect(isValidOrgSlug(null)).toBe(false);
		expect(isValidOrgSlug(42)).toBe(false);
	});
});
