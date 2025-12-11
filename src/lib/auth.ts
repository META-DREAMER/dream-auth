import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { emailOTP, siwe } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Pool } from "pg";
import { http, verifyMessage, createPublicClient,  } from "viem";
import { generateSiweNonce } from "viem/siwe";
import { serverEnv } from "@/env";
import { mainnet } from "viem/chains";

const pool = new Pool({
	connectionString: serverEnv.DATABASE_URL,
});

// Extract hostname from BETTER_AUTH_URL for WebAuthn rpID
const authUrl = new URL(serverEnv.BETTER_AUTH_URL);

export const auth = betterAuth({
	database: pool,
	baseURL: serverEnv.BETTER_AUTH_URL,
	secret: serverEnv.BETTER_AUTH_SECRET,

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
	},

	// Enable changing email address with verification link
	user: {
		changeEmail: {
			enabled: true,
			updateEmailWithoutVerification: true,
		},
	},

	// Email verification config - used by changeEmail to send verification link
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			// TODO: Integrate with email service (Resend, SendGrid, etc.)
			console.log(`[Email Verification] Send to: ${user.email}`);
			console.log(`[Email Verification] URL: ${url}`);
		},
	},

	// Enable account linking so users can link wallets to existing accounts
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["siwe", "email-password", "email-otp"],
			allowDifferentEmails: true,
		},
	},

	session: {
		// Note: Cookie caching has issues with TanStack Start's SSR context
		// Disable until better-auth fixes compatibility
		// cookieCache: {
		// 	enabled: true,
		// 	maxAge: 5 * 60, // 5 minutes
		// },
	},

	// advanced: {
		// cookiePrefix: "auth",
		// cookies: {
			// session_token: {
				// attributes: {
					// httpOnly: true,
					// secure: process.env.NODE_ENV === "production",
					// sameSite: "lax",
					// Only set domain if explicitly configured (for cross-subdomain auth)
					// When undefined, cookie uses current origin (works for localhost)
					// ...(serverEnv.COOKIE_DOMAIN && { domain: serverEnv.COOKIE_DOMAIN }),
				// },
			// },
		// },
	// },

	plugins: [
		// Passkey/WebAuthn authentication
		...(serverEnv.ENABLE_PASSKEYS
			? [
					passkey({
						rpName: "Dream Auth",
						rpID: authUrl.hostname,
						origin: serverEnv.BETTER_AUTH_URL,
					}),
				]
			: []),
		// SIWE (Sign-In With Ethereum) authentication
		...(serverEnv.ENABLE_SIWE
			? [
					siwe({
						domain: authUrl.hostname,
						getNonce: async () => {
							// Generate a cryptographically secure random nonce
							// Better-auth handles nonce storage and validation internally
							return generateSiweNonce();
						},
						verifyMessage: async ({ message, signature, address }) => {
							try {
								// Verify the signature using viem
								// Better-auth validates the nonce internally
								const isValid = await verifyMessage({
									address: address as `0x${string}`,
									message,
									signature: signature as `0x${string}`,
								});

								return isValid;
							} catch (error) {
								console.error("SIWE verification failed:", error);
								return false;
							}
						},
						ensLookup: async ({ walletAddress }) => {
							try {
							  // Optional: lookup ENS name and avatar using viem
							  // You can use viem's ENS utilities here
							  const client = createPublicClient({
								chain: mainnet,
								transport: http(),
							  });
							  const ensName = await client.getEnsName({
								address: walletAddress as `0x${string}`,
							  });
							  const ensAvatar = ensName
								? await client.getEnsAvatar({
									name: ensName,
								  })
								: null;
							  return {
								name: ensName || walletAddress,
								avatar: ensAvatar || "",
							  };
							} catch {
							  return {
								name: walletAddress,
								avatar: "",
							  };
							}
						  },

					}),
				]
			: []),
		// Email OTP for linking emails to accounts
		emailOTP({
			overrideDefaultEmailVerification: true,
			async sendVerificationOTP({ email, otp, type }) {
				// TODO: Integrate with email service (Resend, SendGrid, etc.)
				console.log(
					`[Email OTP] Send to: ${email}, OTP: ${otp}, Type: ${type}`,
				);
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/6136f52c-51f2-4bdf-ae81-480aede60612',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:sendVerificationOTP',message:'CORRECT CALLBACK - OTP sendVerificationOTP',data:{email,otp,type},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1-H3'})}).catch(()=>{});
				// #endregion
			},
		}),
		// TanStack Start cookie handling - must be last plugin
		tanstackStartCookies(),
	],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;

