import { createHash, randomBytes } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
	choosePasswordSignIn,
	signInWithEmailCode,
} from "../../helpers/email-code";
import { registerUser } from "../../helpers/navigation";
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
	return { url: `/oauth2/authorize?${query}`, state, verifier };
}

/** A signed-in password user. */
async function signUp(page: Page, _baseURL: string, label: string) {
	const email = `e2e-oauth-${label}-${Date.now()}@example.com`;
	await registerUser(page, "E2E OAuth User", email, PASSWORD);
	return email;
}

/** Wait for the client callback and check it carries a code for our state. */
async function expectCallback(page: Page, baseURL: string, state: string) {
	await page.waitForURL((url) => url.href.startsWith(`${baseURL}/callback?`));
	const callback = new URL(page.url());
	expect(callback.searchParams.get("error")).toBeNull();
	expect(callback.searchParams.get("code")).toBeTruthy();
	expect(callback.searchParams.get("state")).toBe(state);
	return callback.searchParams.get("code") as string;
}

test.describe("Sign-in on /login reached from an OIDC client", () => {
	test("the signed query survives hydration", async ({ page, baseURL }) => {
		const { url } = authorizeUrl(baseURL as string, "trusted-client");
		await page.goto(url);
		await page.waitForURL(/\/login\?/);
		await page.getByRole("button", { name: "Email me a code" }).waitFor();

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

	// Keep this test: it is the only one guarding the race between /login's own
	// bounce-back navigation and the provider's { redirect, url } response. The
	// passkey test passes even without the navigateAfterSignIn guard.
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
		await choosePasswordSignIn(page);
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Password").fill(PASSWORD);
		await page.getByRole("button", { name: "Sign in", exact: true }).click();

		await expectCallback(page, base, state);
	});

	// The code step must keep the signed query in the URL (both requests echo
	// it back), and the passkey offer must run before the provider's
	// continuation sends the browser to the app.
	test("email code sign-in, with the passkey offer, continues to the client callback", async ({
		page,
		baseURL,
		pool,
	}) => {
		const base = baseURL as string;
		const email = await signUp(page, base, "code");
		await page.context().clearCookies();

		const { url, state } = authorizeUrl(base, "trusted-client");
		await page.goto(url);
		await page.waitForURL(/\/login\?/);
		const loginUrl = page.url();

		await signInWithEmailCode(page, pool, email);
		await expect(page.getByText("Skip the code next time")).toBeVisible();
		expect(page.url()).toBe(loginUrl);
		await page.getByRole("button", { name: "Not now" }).click();

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
		await choosePasswordSignIn(page);
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Password").fill(PASSWORD);
		await page.getByRole("button", { name: "Sign in", exact: true }).click();

		await page.waitForURL(/\/consent\?/);
		await page.getByRole("button", { name: "Authorize" }).click();

		await expectCallback(page, base, state);
	});
});

// The callback alone proves nothing for the app: it still has to redeem the
// code. Regression (better-auth 1.7.25): every redemption failed with
// invalid_grant "invalid code", so Immich and Grafana could not sign in.
test.describe("Redeeming the code at the token endpoint", () => {
	async function redeem(
		request: APIRequestContext,
		base: string,
		code: string,
		verifier: string,
	) {
		const res = await request.post("/oauth2/token", {
			form: {
				grant_type: "authorization_code",
				code,
				redirect_uri: `${base}/callback`,
				client_id: "post-client",
				client_secret: "post-secret",
				code_verifier: verifier,
			},
		});
		return { status: res.status(), body: await res.json() };
	}

	async function expectTokens(
		request: APIRequestContext,
		base: string,
		code: string,
		verifier: string,
	) {
		const first = await redeem(request, base, code, verifier);
		expect(first.status, JSON.stringify(first.body)).toBe(200);
		expect(first.body.access_token).toBeTruthy();
		expect(first.body.id_token).toBeTruthy();

		// A code is single-use.
		const replay = await redeem(request, base, code, verifier);
		expect(replay.status).toBe(400);
		expect(replay.body.error).toBe("invalid_grant");
	}

	test("password sign-in, client_secret_post + PKCE, as Immich does", async ({
		page,
		baseURL,
		request,
	}) => {
		const base = baseURL as string;
		const email = await signUp(page, base, "exchange-password");
		await page.context().clearCookies();

		const { url, state, verifier } = authorizeUrl(base, "post-client");
		await page.goto(url);
		await page.waitForURL(/\/login\?/);
		await choosePasswordSignIn(page);
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Password").fill(PASSWORD);
		await page.getByRole("button", { name: "Sign in", exact: true }).click();
		const code = await expectCallback(page, base, state);

		await expectTokens(request, base, code, verifier);
	});

	test("email code sign-in with the passkey offer, client_secret_post + PKCE", async ({
		page,
		baseURL,
		request,
		pool,
	}) => {
		const base = baseURL as string;
		const email = await signUp(page, base, "exchange-code");
		await page.context().clearCookies();

		const { url, state, verifier } = authorizeUrl(base, "post-client");
		await page.goto(url);
		await page.waitForURL(/\/login\?/);
		await signInWithEmailCode(page, pool, email);
		await page.getByRole("button", { name: "Not now" }).click();
		const code = await expectCallback(page, base, state);

		await expectTokens(request, base, code, verifier);
	});
});
