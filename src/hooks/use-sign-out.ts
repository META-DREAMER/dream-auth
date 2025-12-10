import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useDisconnect } from "wagmi";
import { signOut } from "@/lib/auth-client";

/**
 * Hook that provides a sign-out handler with navigation.
 * Also disconnects the wallet from wagmi.
 */
export function useSignOut() {
	const navigate = useNavigate();
	const { disconnect } = useDisconnect();

	return useCallback(async () => {
		disconnect();
		await signOut();
		navigate({ to: "/login" });
	}, [navigate, disconnect]);
}
