/**
 * Shared nonce store with expiration management for SIWE authentication.
 * Used by both the SIWE server function and BetterAuth's SIWE plugin.
 *
 * Note: For production, replace this in-memory store with Redis or database storage.
 */

// Store nonces with their expiration timestamps
const nonceStore = new Map<string, number>();

/**
 * Store a nonce with an expiration time.
 * @param nonce - The nonce string to store
 * @param ttlMs - Time-to-live in milliseconds (default: 5 minutes)
 */
export function storeNonce(nonce: string, ttlMs = 5 * 60 * 1000): void {
	nonceStore.set(nonce, Date.now() + ttlMs);
}

/**
 * Check if a nonce is valid (exists and not expired).
 * Does NOT consume the nonce - use validateAndConsumeNonce for that.
 * @param nonce - The nonce to validate
 * @returns true if valid, false otherwise
 */
export function isNonceValid(nonce: string): boolean {
	const expires = nonceStore.get(nonce);
	return !!expires && expires >= Date.now();
}

/**
 * Validate and consume a nonce (single use).
 * Returns true if the nonce was valid, false otherwise.
 * The nonce is deleted regardless of validity.
 * @param nonce - The nonce to validate and consume
 * @returns true if valid, false otherwise
 */
export function validateAndConsumeNonce(nonce: string): boolean {
	const expires = nonceStore.get(nonce);
	if (!expires || expires < Date.now()) {
		nonceStore.delete(nonce);
		return false;
	}
	nonceStore.delete(nonce);
	return true;
}

// Clean up expired nonces periodically (every minute)
setInterval(() => {
	const now = Date.now();
	for (const [nonce, expires] of nonceStore.entries()) {
		if (expires < now) {
			nonceStore.delete(nonce);
		}
	}
}, 60000);
