import { mergeTests } from "@playwright/test";
import { authFixtures } from "./auth-fixtures";
import { databaseFixtures } from "./database-fixtures";

/**
 * Combined E2E test fixtures
 *
 * Usage:
 * ```ts
 * import { test, expect } from "@e2e/fixtures";
 *
 * test("my test", async ({ page, pool, authenticatedPage }) => {
 *   // ...
 * });
 * ```
 */
export const test = mergeTests(databaseFixtures, authFixtures);
export { expect } from "@playwright/test";
export type { TestUser } from "../helpers/test-user-factory";
export type { AuthFixtures } from "./auth-fixtures";
// Re-export types
export type { DatabaseFixtures } from "./database-fixtures";
