import { createServerFn } from "@tanstack/react-start";
import { generateRandomString } from "better-auth/crypto";
import { SiweMessage } from "siwe";
import { z } from "zod";
import { serverEnv } from "@/env";
import { storeNonce } from "./nonce-store";

const ChallengeInputSchema = z.object({
	address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
	chainId: z.number().int().positive(),
	mode: z.enum(["signin", "link"]),
});

/**
 * Server function to create a SIWE challenge.
 * Generates a nonce and returns a prepared SIWE message for the client to sign.
 *
 * This consolidates nonce generation and message creation into a single server call,
 * reducing round trips and keeping the SIWE message format server-controlled.
 */
export const createSiweChallengeFn = createServerFn({ method: "POST" })
	.inputValidator(ChallengeInputSchema)
	.handler(async ({ data }) => {
		const authUrl = new URL(serverEnv.BETTER_AUTH_URL);

		// Generate a cryptographically secure random nonce
		const nonce = generateRandomString(32);

		// Store nonce with 5 minute expiration
		storeNonce(nonce);

		// Determine statement based on mode
		const statement =
			data.mode === "link"
				? "Link your Ethereum wallet to your account"
				: "Sign in with your Ethereum wallet to Auth Server";

		// Create SIWE message using server-controlled domain and URI
		const siweMessage = new SiweMessage({
			domain: authUrl.hostname,
			address: data.address,
			statement,
			uri: serverEnv.BETTER_AUTH_URL,
			version: "1",
			chainId: data.chainId,
			nonce,
		});

		return {
			message: siweMessage.prepareMessage(),
			nonce,
		};
	});
