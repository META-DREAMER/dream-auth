import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { passkeyClient } from "@better-auth/passkey/client";
import {
	emailOTPClient,
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
		oauthProviderClient(),
		// Organization plugin for invitation-based access control
		organizationClient({
			teams: { enabled: true },
			// Match the additional fields from the server-side schema
			schema: {
				invitation: {
					additionalFields: {
						// `required: false` must be mirrored here, not just on the
						// server: since 1.7 the client input type is derived from this
						// object, and omitting it makes walletAddress mandatory on
						// every inviteMember() call.
						walletAddress: {
							type: "string",
							required: false,
							input: true,
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
