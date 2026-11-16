import type { Page } from "@playwright/test";
import type { Pool } from "pg";

/**
 * The sign-in code last issued for `email`, read from better-auth's
 * `verification` table (the e2e server uses the log mailer, and emailOTP
 * stores codes as `<otp>:<attempts>` by default). Delivery is not awaited by
 * the server, but the row is written before it answers.
 */
export async function readSignInCode(pool: Pool, email: string) {
	const identifier = `sign-in-otp-${email.toLowerCase()}`;
	const deadline = Date.now() + 10_000;
	while (Date.now() < deadline) {
		const { rows } = await pool.query<{ value: string }>(
			`SELECT value FROM verification WHERE identifier = $1
			 ORDER BY "createdAt" DESC LIMIT 1`,
			[identifier],
		);
		if (rows[0]) return rows[0].value.split(":")[0];
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error(`No sign-in code was issued for ${email}`);
}

/**
 * Ask for a code on the current `/login` or `/register` page and enter it.
 * Fill any other fields (the name on `/register`) first.
 */
export async function signInWithEmailCode(
	page: Page,
	pool: Pool,
	email: string,
) {
	await page.getByLabel("Email").fill(email);
	const sent = page.waitForResponse((r) =>
		r.url().endsWith("/api/auth/email-otp/send-verification-otp"),
	);
	await page.getByRole("button", { name: "Email me a code" }).click();
	await sent;
	const code = await readSignInCode(pool, email);
	// input-otp renders one real input behind the six slots.
	await page.locator("input[data-input-otp]").fill(code);
	await page.getByRole("button", { name: "Continue" }).click();
}

/** Switch `/login` from the default email code to the password form. */
export async function choosePasswordSignIn(page: Page) {
	await page
		.getByRole("button", { name: "Sign in with a password instead" })
		.click();
}
