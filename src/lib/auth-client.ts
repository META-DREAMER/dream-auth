import { passkeyClient } from "@better-auth/passkey/client";
import { emailOTPClient, siweClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { clientEnv } from "@/env.client";

export const authClient = createAuthClient({
	// baseURL is optional for same-domain setups - better-auth uses relative paths
	// Only set VITE_AUTH_URL if you need cross-origin auth (e.g., separate auth server)
	baseURL: clientEnv.VITE_AUTH_URL,
	plugins: [passkeyClient(), siweClient(), emailOTPClient()],
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
} = authClient;
