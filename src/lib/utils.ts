import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Check if an email is a SIWE-generated placeholder email.
 * SIWE creates emails in the format: 0x<40 hex chars>@domain
 */
export function isSiweGeneratedEmail(
	email: string | null | undefined,
): boolean {
	if (!email) return false;
	// Ethereum addresses are 0x followed by 40 hex characters
	const siweEmailPattern = /^0x[a-fA-F0-9]{40}@/i;
	return siweEmailPattern.test(email);
}

/**
 * Get the user's real email, returning null if it's a SIWE-generated placeholder.
 */
export function getRealEmail(email: string | null | undefined): string | null {
	if (!email || isSiweGeneratedEmail(email)) return null;
	return email;
}
