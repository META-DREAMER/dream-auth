import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth, type Session } from "./auth";

export const getSessionFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<Session | null> => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });
		return session;
	},
);

