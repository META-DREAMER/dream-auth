import { passkeyClient } from "@better-auth/passkey/client";
import {
	emailOTPClient,
	oidcClient,
	organizationClient,
	siweClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { clientEnv } from "@/env.client";

export const authClient = createAuthClient({
	// baseURL is optional for same-domain setups - better-auth uses relative paths
	// Only set VITE_AUTH_URL if you need cross-origin auth (e.g., separate auth server)
	baseURL: clientEnv.VITE_AUTH_URL,
	plugins: [
		passkeyClient(),
		siweClient(),
		emailOTPClient(),
		oidcClient(),
		// Organization plugin for invitation-based access control
		organizationClient({
			teams: { enabled: true },
			// Match the additional fields from the server-side schema
			schema: {
				invitation: {
					additionalFields: {
						walletAddress: {
							type: "string",
						},
					},
				},
			},
		}),
	],
});

export const {
	signIn,
	signUp,
	signOut,
	useSession,
	getSession,
	passkey,
	siwe,
	emailOtp,
	oauth2,
	organization,
} = authClient;
