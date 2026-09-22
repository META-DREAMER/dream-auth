import { parseSiweMessage } from "viem/siwe";
import { pool } from "@/lib/db";

/**
 * Registration gate for `ENABLE_REGISTRATION=false` deployments.
 *
 * Signup is allowed only when the incoming identity matches a pending,
 * non-expired organization invitation - either by email, or by the wallet
 * address on a wallet invitation.
 *
 * This lives behind Better Auth's `user.validateUserInfo` hook (added in
 * 1.7.0), which runs on *every* provisioning path. The previous
 * `databaseHooks.user.create.before` gate only ever saw the email, so SIWE
 * signups were checked against the placeholder email the SIWE plugin mints
 * (`0x…@siwe.placeholder.invalid`). That never matched an invitation, which
 * made wallet invitations unreachable for anyone without an existing account.
 */

/** A wallet address in lowercase hex form. */
type WalletAddress = string;

const EVM_ADDRESS_RE = /^0x[0-9a-f]{40}$/;

/**
 * Pull every wallet address that the incoming identity can be attributed to.
 *
 * Two sources, because neither alone is complete:
 *
 * 1. The local part of the email. The SIWE plugin mints
 *    `<walletAddress>@siwe.placeholder.invalid` (or `<walletAddress>@<domain>`
 *    when `emailDomainName` is set) for a wallet user with no email.
 * 2. The signed ERC-4361 message on the request. When the caller passed an
 *    `email` to `/siwe/verify`, the placeholder is not used and the message is
 *    the only place the address appears. Better Auth has already verified the
 *    signature, the domain and the nonce before user creation runs, so the
 *    address in this message is proven, not claimed.
 */
export function collectWalletAddresses(input: {
	email?: string | null;
	requestBody?: unknown;
}): WalletAddress[] {
	const addresses = new Set<WalletAddress>();

	const localPart = input.email?.split("@")[0]?.toLowerCase();
	if (localPart && EVM_ADDRESS_RE.test(localPart)) {
		addresses.add(localPart);
	}

	const message = (input.requestBody as { message?: unknown } | undefined)
		?.message;
	if (typeof message === "string" && message.length > 0) {
		try {
			const parsed = parseSiweMessage(message);
			const address = parsed.address?.toLowerCase();
			if (address && EVM_ADDRESS_RE.test(address)) {
				addresses.add(address);
			}
		} catch {
			// Not a SIWE message - nothing to attribute.
		}
	}

	return [...addresses];
}

/** How the gate looks up pending invitations. Swapped out in tests. */
export interface PendingInvitationLookup {
	/** Is there a pending, non-expired invitation for this email address? */
	hasInvitationForEmail(email: string): Promise<boolean>;
	/** Is there a pending, non-expired invitation for this wallet address? */
	hasInvitationForWallet(walletAddress: WalletAddress): Promise<boolean>;
}

/** The live lookup, against the `invitation` table. */
export const dbInvitationLookup: PendingInvitationLookup = {
	async hasInvitationForEmail(email) {
		const result = await pool.query(
			`SELECT 1 FROM invitation
			 WHERE lower(email) = $1 AND status = 'pending' AND "expiresAt" > NOW()
			 LIMIT 1`,
			[email.toLowerCase()],
		);
		return result.rows.length > 0;
	},

	async hasInvitationForWallet(walletAddress) {
		const result = await pool.query(
			`SELECT 1 FROM invitation
			 WHERE lower("walletAddress") = $1 AND status = 'pending' AND "expiresAt" > NOW()
			 LIMIT 1`,
			[walletAddress.toLowerCase()],
		);
		return result.rows.length > 0;
	},
};

/**
 * Decide whether a brand-new user may be provisioned.
 *
 * Returns `true` when public registration is on, or when a pending invitation
 * matches either the email or one of the wallet addresses.
 */
export async function isSignupAllowed(input: {
	enableRegistration: boolean;
	email?: string | null;
	walletAddresses?: WalletAddress[];
	lookup?: PendingInvitationLookup;
}): Promise<boolean> {
	if (input.enableRegistration) return true;

	const lookup = input.lookup ?? dbInvitationLookup;

	if (input.email && (await lookup.hasInvitationForEmail(input.email))) {
		return true;
	}

	for (const walletAddress of input.walletAddresses ?? []) {
		if (await lookup.hasInvitationForWallet(walletAddress)) {
			return true;
		}
	}

	return false;
}

/** Rejection surfaced by `validateUserInfo` when the gate closes. */
export const REGISTRATION_DISABLED_ERROR = {
	error: "registration_disabled",
	errorDescription:
		"Registration is disabled. Please contact an administrator for an invitation.",
} as const;
