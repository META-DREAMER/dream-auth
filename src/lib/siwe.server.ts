import { createServerFn } from "@tanstack/react-start";
import { SiweMessage } from "siwe";
import { z } from "zod";
import { serverEnv } from "@/env";
import { siwe } from "@/lib/auth-client";

const ChallengeInputSchema = z.object({
	address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
	chainId: z.number().int().positive(),
	mode: z.enum(["signin", "link"]),
});

/**
 * Server function to create a SIWE challenge.
 * Uses better-auth's SIWE nonce generation to ensure proper nonce handling.
 * Returns a prepared SIWE message for the client to sign.
 */
export const createSiweChallengeFn = createServerFn({ method: "POST" })
	.inputValidator(ChallengeInputSchema)
	.handler(async ({ data }) => {
		const authUrl = new URL(serverEnv.BETTER_AUTH_URL);

		// Get nonce from better-auth's SIWE plugin using the internal API
		// This ensures the nonce goes through better-auth's proper flow and tracking
		const nonceResponse = await siwe.nonce({
			walletAddress: data.address,
			chainId: data.chainId,
		});

		if (nonceResponse.error || !nonceResponse.data?.nonce) {
			throw new Error(nonceResponse.error?.message || "Failed to generate SIWE nonce");
		}
		const nonce = nonceResponse.data?.nonce;
		// Determine statement based on mode
		const statement =
			data.mode === "link"
				? "Link your Ethereum wallet to your account"
				: "Sign in with your Ethereum wallet to Auth Server";

		// Create SIWE message using the nonce from better-auth
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
