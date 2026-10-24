import type { CDPSession, Page } from "@playwright/test";

/**
 * A CDP virtual WebAuthn authenticator (Chromium only): a platform
 * authenticator with resident keys and user verification, so passkeys can be
 * registered and used without a person at the keyboard.
 */
export type VirtualAuthenticator = {
	/**
	 * Whether the authenticator answers ceremonies on its own. `/login` starts
	 * a conditional-UI (autofill) ceremony on mount; with presence on, that
	 * ceremony would sign in before the button is clicked. Turn it off before
	 * opening `/login`, then back on right before clicking the button.
	 */
	setPresence(enabled: boolean): Promise<void>;
};

export async function addVirtualAuthenticator(
	page: Page,
): Promise<VirtualAuthenticator> {
	const cdp: CDPSession = await page.context().newCDPSession(page);
	await cdp.send("WebAuthn.enable");
	const { authenticatorId } = await cdp.send(
		"WebAuthn.addVirtualAuthenticator",
		{
			options: {
				protocol: "ctap2",
				transport: "internal",
				hasResidentKey: true,
				hasUserVerification: true,
				isUserVerified: true,
				automaticPresenceSimulation: true,
			},
		},
	);

	return {
		async setPresence(enabled) {
			await cdp.send("WebAuthn.setAutomaticPresenceSimulation", {
				authenticatorId,
				enabled,
			});
		},
	};
}

/**
 * Register a passkey for the signed-in user through the settings page.
 */
export async function registerPasskeyViaSettings(page: Page): Promise<void> {
	await page.goto("/settings");
	await page.getByRole("button", { name: "Add Passkey" }).click();
	await page.locator("#passkey-name").fill("e2e virtual authenticator");
	await page.getByRole("button", { name: "Register Passkey" }).click();
	await page.getByRole("dialog").waitFor({ state: "hidden" });
}
