import { organization } from "@/lib/auth-client";
import { clientEnv } from "@/env.client";

/**
 * Generate deterministic email from wallet address.
 * Uses the same pattern as SIWE plugin for consistency.
 * This ensures the invitation email matches the email that SIWE creates for the user.
 *
 * @example getWalletEmail("0xABC123...") => "0xabc123...@auth.example.com"
 */
export function getWalletEmail(walletAddress: string): string {
	// Use VITE_AUTH_URL if available, otherwise use current origin
	const authUrl = clientEnv.VITE_AUTH_URL || window.location.origin;
	const domain = new URL(authUrl).host;
	return `${walletAddress.toLowerCase()}@${domain}`;
}

/**
 * Invite a user by wallet address.
 * Creates an invitation that requires SIWE sign-in with the specified wallet.
 *
 * The user must sign in with SIWE using this exact wallet address to accept the invitation.
 * The beforeAcceptInvitation hook on the server verifies wallet ownership.
 *
 * @param walletAddress - Ethereum wallet address (0x...)
 * @param role - Role to assign (e.g., "member", "admin", "owner")
 * @param organizationId - Organization to invite the user to
 */
export async function inviteByWallet(
	walletAddress: string,
	role: "member" | "admin" | "owner",
	organizationId: string,
) {
	// Generate deterministic email matching SIWE pattern
	const email = getWalletEmail(walletAddress);

	return organization.inviteMember({
		email,
		role,
		organizationId,
		// Store original wallet address for verification in beforeAcceptInvitation hook
		walletAddress: walletAddress.toLowerCase(),
	});
}

/**
 * Invite a user by email address.
 * Creates a standard email invitation.
 *
 * The user can sign up with email/password or link their email to accept.
 *
 * @param email - Email address to invite
 * @param role - Role to assign (e.g., "member", "admin", "owner")
 * @param organizationId - Organization to invite the user to
 */
export async function inviteByEmail(
	email: string,
	role: "member" | "admin" | "owner",
	organizationId: string,
) {
	return organization.inviteMember({
		email: email.toLowerCase(),
		role,
		organizationId,
		// No wallet address for email invitations
		walletAddress: undefined,
	});
}

/**
 * Check if an invitation is wallet-based.
 *
 * @param invitation - Invitation object from getInvitation
 * @returns true if this is a wallet-based invitation
 */
export function isWalletInvitation(invitation: {
	walletAddress?: string | null;
}): boolean {
	return !!invitation.walletAddress;
}

/**
 * Get the wallet address from an invitation, if it's a wallet invitation.
 *
 * @param invitation - Invitation object from getInvitation
 * @returns Wallet address or null
 */
export function getInvitationWalletAddress(invitation: {
	walletAddress?: string | null;
}): string | null {
	return invitation.walletAddress || null;
}

