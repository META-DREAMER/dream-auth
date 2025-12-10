import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { signOut } from "@/lib/auth-client";

/**
 * Hook that provides a sign-out handler with navigation.
 */
export function useSignOut() {
	const navigate = useNavigate();

	return useCallback(async () => {
		await signOut();
		navigate({ to: "/login" });
	}, [navigate]);
}
