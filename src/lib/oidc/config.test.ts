import * as fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	loadOidcClientsFromFile,
	mergeOidcClients,
	parseOidcClientsJson,
} from "./config";
import type { OidcClientConfig } from "./schemas";

// Mock fs module
vi.mock("node:fs", () => ({
	readFileSync: vi.fn(),
	existsSync: vi.fn(),
}));

describe("parseOidcClientsJson", () => {
	const validClient = {
		clientId: "app1",
		name: "App One",
		clientSecret: "secret1",
		type: "web",
		redirectURLs: ["https://app1.com/cb"],
	};

	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("parses valid JSON array of clients", () => {
		const json = JSON.stringify([validClient]);
		const result = parseOidcClientsJson(json, "TEST");

		expect(result).toHaveLength(1);
		expect(result[0].clientId).toBe("app1");
		expect(result[0].name).toBe("App One");
	});

	it("parses multiple clients", () => {
		const clients = [
			validClient,
			{ ...validClient, clientId: "app2", name: "App Two" },
		];
		const json = JSON.stringify(clients);
		const result = parseOidcClientsJson(json, "TEST");

		expect(result).toHaveLength(2);
		expect(result[0].clientId).toBe("app1");
		expect(result[1].clientId).toBe("app2");
	});

	it("returns empty array for non-array JSON", () => {
		const result = parseOidcClientsJson('{"not": "array"}', "TEST");

		expect(result).toEqual([]);
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("must be a JSON array"),
		);
	});

	it("returns empty array for invalid JSON", () => {
		const result = parseOidcClientsJson("not valid json", "TEST");

		expect(result).toEqual([]);
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Failed to parse"),
			expect.anything(),
		);
	});

	it("filters out invalid clients from array", () => {
		const json = JSON.stringify([
			validClient,
			{ clientId: "invalid" }, // Missing required fields
		]);
		const result = parseOidcClientsJson(json, "TEST");

		expect(result).toHaveLength(1);
		expect(result[0].clientId).toBe("app1");
	});

	it("logs validation errors for invalid clients", () => {
		const json = JSON.stringify([{ clientId: "invalid" }]);
		parseOidcClientsJson(json, "TEST");

		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Invalid client config"),
			expect.anything(),
		);
	});

	it("returns empty array for empty JSON array", () => {
		const result = parseOidcClientsJson("[]", "TEST");
		expect(result).toEqual([]);
	});

	it("applies default values from schema", () => {
		const clientWithoutDefaults = {
			clientId: "test",
			name: "Test",
			clientSecret: "secret",
			redirectURLs: ["https://example.com/cb"],
		};
		const json = JSON.stringify([clientWithoutDefaults]);
		const result = parseOidcClientsJson(json, "TEST");

		expect(result[0].type).toBe("web"); // default
		expect(result[0].skipConsent).toBe(false); // default
		expect(result[0].disabled).toBe(false); // default
	});
});

describe("loadOidcClientsFromFile", () => {
	const validClientJson = JSON.stringify([
		{
			clientId: "file-app",
			name: "File App",
			clientSecret: "secret",
			type: "web",
			redirectURLs: ["https://file-app.com/cb"],
		},
	]);

	beforeEach(() => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.readFileSync).mockReturnValue(validClientJson);
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("loads clients from JSON file", () => {
		const result = loadOidcClientsFromFile("/config/clients.json");

		expect(result).toHaveLength(1);
		expect(result[0].clientId).toBe("file-app");
	});

	it("returns empty array if file does not exist (non-production)", () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";

		const result = loadOidcClientsFromFile("/nonexistent.json");

		expect(result).toEqual([]);
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("does not exist"),
		);

		process.env.NODE_ENV = originalEnv;
	});

	it("throws in production if file does not exist", () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";

		try {
			expect(() => loadOidcClientsFromFile("/nonexistent.json")).toThrow(
				/OIDC_CLIENTS_FILE not found/,
			);
		} finally {
			process.env.NODE_ENV = originalEnv;
		}
	});

	it("detects YAML format starting with oidcClients:", () => {
		vi.mocked(fs.readFileSync).mockReturnValue(
			"oidcClients:\n  - clientId: app",
		);
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";

		const result = loadOidcClientsFromFile("/config/clients.yaml");

		expect(result).toEqual([]);
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("YAML format detected"),
		);

		process.env.NODE_ENV = originalEnv;
	});

	it("detects YAML format starting with dash", () => {
		vi.mocked(fs.readFileSync).mockReturnValue("- clientId: app\n  name: App");
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";

		const result = loadOidcClientsFromFile("/config/clients.yaml");

		expect(result).toEqual([]);
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("YAML format detected"),
		);

		process.env.NODE_ENV = originalEnv;
	});

	it("throws in production for YAML format", () => {
		vi.mocked(fs.readFileSync).mockReturnValue(
			"oidcClients:\n  - clientId: app",
		);
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";

		try {
			expect(() => loadOidcClientsFromFile("/config/clients.yaml")).toThrow(
				/YAML format not supported/,
			);
		} finally {
			process.env.NODE_ENV = originalEnv;
		}
	});

	it("parses JSON starting with array bracket", () => {
		vi.mocked(fs.readFileSync).mockReturnValue(validClientJson);

		const result = loadOidcClientsFromFile("/config/clients.json");

		expect(result).toHaveLength(1);
		expect(result[0].clientId).toBe("file-app");
	});

	it("handles read errors in non-production", () => {
		vi.mocked(fs.readFileSync).mockImplementation(() => {
			throw new Error("Read error");
		});
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";

		const result = loadOidcClientsFromFile("/config/clients.json");

		expect(result).toEqual([]);
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read"),
			expect.anything(),
		);

		process.env.NODE_ENV = originalEnv;
	});

	it("throws read errors in production", () => {
		vi.mocked(fs.readFileSync).mockImplementation(() => {
			throw new Error("Read error");
		});
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";

		try {
			expect(() => loadOidcClientsFromFile("/config/clients.json")).toThrow(
				/Failed to read OIDC_CLIENTS_FILE/,
			);
		} finally {
			process.env.NODE_ENV = originalEnv;
		}
	});
});

describe("mergeOidcClients", () => {
	const envClient: OidcClientConfig = {
		clientId: "env-app",
		name: "Env App",
		clientSecret: "secret",
		type: "web",
		redirectURLs: ["https://env.com/cb"],
		skipConsent: false,
		disabled: false,
	};

	const fileClient: OidcClientConfig = {
		clientId: "file-app",
		name: "File App",
		clientSecret: "secret",
		type: "web",
		redirectURLs: ["https://file.com/cb"],
		skipConsent: false,
		disabled: false,
	};

	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("merges clients from both sources", () => {
		const result = mergeOidcClients([envClient], [fileClient]);

		expect(result).toHaveLength(2);
		expect(result.map((c) => c.clientId)).toEqual(["env-app", "file-app"]);
	});

	it("merges multiple clients from each source", () => {
		const envClients = [
			envClient,
			{ ...envClient, clientId: "env-app-2", name: "Env App 2" },
		];
		const fileClients = [
			fileClient,
			{ ...fileClient, clientId: "file-app-2", name: "File App 2" },
		];
		const result = mergeOidcClients(envClients, fileClients);

		expect(result).toHaveLength(4);
	});

	it("returns empty array when both sources are empty", () => {
		const result = mergeOidcClients([], []);
		expect(result).toEqual([]);
	});

	it("handles one empty source", () => {
		const result = mergeOidcClients([envClient], []);
		expect(result).toHaveLength(1);
		expect(result[0].clientId).toBe("env-app");
	});

	it("logs error for duplicate client IDs", () => {
		const duplicate = { ...fileClient, clientId: "env-app" };
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";

		const result = mergeOidcClients([envClient], [duplicate]);

		expect(result).toHaveLength(2); // Still returns all
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Duplicate client IDs"),
		);

		process.env.NODE_ENV = originalEnv;
	});

	it("throws in production for duplicate client IDs", () => {
		const duplicate = { ...fileClient, clientId: "env-app" };
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";

		try {
			expect(() => mergeOidcClients([envClient], [duplicate])).toThrow(
				/Duplicate client IDs/,
			);
		} finally {
			process.env.NODE_ENV = originalEnv;
		}
	});

	it("detects multiple duplicates", () => {
		const envClients = [
			envClient,
			{ ...envClient, clientId: "shared-1", name: "Shared 1 Env" },
			{ ...envClient, clientId: "shared-2", name: "Shared 2 Env" },
		];
		const fileClients = [
			{ ...fileClient, clientId: "shared-1", name: "Shared 1 File" },
			{ ...fileClient, clientId: "shared-2", name: "Shared 2 File" },
		];
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";

		mergeOidcClients(envClients, fileClients);

		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("shared-1"),
		);
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("shared-2"),
		);

		process.env.NODE_ENV = originalEnv;
	});

	it("does not error when no duplicates", () => {
		mergeOidcClients([envClient], [fileClient]);
		expect(console.error).not.toHaveBeenCalled();
	});
});
