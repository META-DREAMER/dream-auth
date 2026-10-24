import { createHash, randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
	addVirtualAuthenticator,
	registerPasskeyViaSettings,
} from "../../helpers/webauthn";

/**
 * Signing in on `/login` when an OIDC client sent the user there.
 *
 * The authorize endpoint redirects to `/login` with a signed query (repeated
 * `ba_param` names plus `sig`), and every sign-in POST from that page carries
 * it back as `oauth_query`. Regression: the router used to re-serialize the
 * query on load, turning the repeated `ba_param` into one JSON array, so every
 * sign-in from that page failed with 400 `invalid_signature` ("Passkey
 * authentication failed" in the UI) while `/login` opened directly worked.
 */

const PASSWORD = "TestPassword123!";

function authorizeUrl(baseURL: string, clientId: string) {
	const state = randomBytes(8).toString("hex");
	const verifier = randomBytes(32).toString("base64url");
	const query = new URLSearchParams({
		response_type: "code",
		client_id: clientId,
		redirect_uri: `${baseURL}/callback`,
		scope: "openid profile email",
		state,
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
		code_challenge_method: "S256",
	});
	return { url: `/oauth2/authorize?${query}`, state };
}

async function signUp(page: Page, baseURL: string, label: string) {
	const email = `e2e-oauth-${label}-${Date.now()}@example.com`;
	const response = await page.request.post("/api/auth/sign-up/email", {
		data: { name: "E2E OAuth User", email, password: PASSWORD },
		headers: { origin: baseURL },
	});
	expect(response.ok()).toBe(true);
	return email;
}

/** Wait for the client callback and check it carries a code for our state. */
async function expectCallback(page: Page, baseURL: string, state: string) {
	await page.waitForURL((url) => url.href.startsWith(`${baseURL}/callback?`));
	const callback = new URL(page.url());
	expect(callback.searchParams.get("error")).toBeNull();
	expect(callback.searchParams.get("code")).toBeTruthy();
	expect(callback.searchParams.get("state")).toBe(state);
}

test.describe("Sign-in on /login reached from an OIDC client", () => {
	test("the signed query survives hydration", async ({ page, baseURL }) => {
		const { url } = authorizeUrl(baseURL as string, "trusted-client");
		await page.goto(url);
		await page.waitForURL(/\/login\?/);
		await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();

		const params = new URL(page.url()).searchParams;
		expect(params.getAll("ba_param").length).toBeGreaterThan(1);
		expect(params.get("sig")).toBeTruthy();
	});

	test("passkey sign-in continues to the client callback", async ({
		page,
		baseURL,
	}) => {
		const base = baseURL as string;
		const authenticator = await addVirtualAuthenticator(page);
		await signUp(page, base, "passkey");
		await registerPasskeyViaSettings(page);
		await page.context().clearCookies();

		// Keep the autofill ceremony started on mount from signing in on its
		// own: the regression is in the button path the owner uses.
		await authenticator.setPresence(false);
		const { url, state } = authorizeUrl(base, "trusted-client");
		await page.goto(url);
		await page.waitForURL(/\/login\?/);
		const button = page.getByRole("button", { name: "Sign in with Passkey" });
		await button.waitFor();

		await authenticator.setPresence(true);
		const verify = page.waitForResponse((r) =>
			r.url().endsWith("/api/auth/passkey/verify-authentication"),
		);
		await button.click();
		expect((await verify).status()).toBe(200);

		await expectCallback(page, base, state);
	});

	test("email/password sign-in continues to the client callback", async ({
		page,
		baseURL,
	}) => {
		const base = baseURL as string;
		const email = await signUp(page, base, "password");
		await page.context().clearCookies();

		const { url, state } = authorizeUrl(base, "trusted-client");
		await page.goto(url);
		await page.waitForURL(/\/login\?/);
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Password").fill(PASSWORD);
		await page.getByRole("button", { name: "Sign in", exact: true }).click();

		await expectCallback(page, base, state);
	});

	test("consent after sign-in continues to the client callback", async ({
		page,
		baseURL,
	}) => {
		const base = baseURL as string;
		const email = await signUp(page, base, "consent");
		await page.context().clearCookies();

		const { url, state } = authorizeUrl(base, "test-client");
		await page.goto(url);
		await page.waitForURL(/\/login\?/);
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Password").fill(PASSWORD);
		await page.getByRole("button", { name: "Sign in", exact: true }).click();

		await page.waitForURL(/\/consent\?/);
		await page.getByRole("button", { name: "Authorize" }).click();

		await expectCallback(page, base, state);
	});
});
