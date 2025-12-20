import {
	createContext,
	use,
	useState,
	useEffect,
	type ReactNode,
} from "react";
import { createIsomorphicFn } from "@tanstack/react-start";
import { z } from "zod";

// ============================================
// Types & Schemas
// ============================================

const UserThemeSchema = z.enum(["light", "dark", "system"]).catch("system");
const AppThemeSchema = z.enum(["light", "dark"]).catch("light");

export type UserTheme = z.infer<typeof UserThemeSchema>;
export type AppTheme = z.infer<typeof AppThemeSchema>;

const THEME_STORAGE_KEY = "ui-theme";

// ============================================
// SSR-Safe Storage Helpers
// ============================================

const getStoredUserTheme = createIsomorphicFn()
	.server((): UserTheme => "system")
	.client((): UserTheme => {
		try {
			const stored = localStorage.getItem(THEME_STORAGE_KEY);
			return UserThemeSchema.parse(stored);
		} catch {
			return "system";
		}
	});

function setStoredTheme(theme: UserTheme): void {
	if (typeof window === "undefined") return;
	try {
		const validatedTheme = UserThemeSchema.parse(theme);
		localStorage.setItem(THEME_STORAGE_KEY, validatedTheme);
	} catch {}
}

const getSystemTheme = createIsomorphicFn()
	.server((): AppTheme => "light")
	.client((): AppTheme => {
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	});

// ============================================
// DOM Manipulation
// ============================================

function handleThemeChange(userTheme: UserTheme) {
	if (typeof window === "undefined") return;

	const root = document.documentElement;
	
	const update = () => {
		root.classList.remove("light", "dark", "system");

		const appTheme = userTheme === "system" ? getSystemTheme() : userTheme;
		root.classList.add(appTheme);

		if (userTheme === "system") {
			root.classList.add("system");
		}
	};

	// Use View Transitions API if available for smooth switching
	if (document.startViewTransition) {
		document.startViewTransition(update);
	} else {
		update();
	}
}

function setupSystemThemeListener(callback: () => void) {
	if (typeof window === "undefined") return () => {};

	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	const handler = () => callback();
	mediaQuery.addEventListener("change", handler);
	return () => mediaQuery.removeEventListener("change", handler);
}

// ============================================
// Inline Script for FOUC Prevention
// ============================================

export const themeScript: string = (() => {
	function themeFn() {
		try {
			const storedTheme = localStorage.getItem("ui-theme") || "system";
			const validTheme = ["light", "dark", "system"].includes(storedTheme)
				? storedTheme
				: "system";

			if (validTheme === "system") {
				const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
					.matches
					? "dark"
					: "light";
				document.documentElement.classList.add(systemTheme, "system");
			} else {
				document.documentElement.classList.add(validTheme);
			}
		} catch {
			const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
				.matches
				? "dark"
				: "light";
			document.documentElement.classList.add(systemTheme, "system");
		}
	}
	return `(${themeFn.toString()})();`;
})();

// ============================================
// Theme Context
// ============================================

type ThemeContextProps = {
	userTheme: UserTheme;
	appTheme: AppTheme;
	setTheme: (theme: UserTheme) => void;
};

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

type ThemeProviderProps = {
	children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
	const [userTheme, setUserTheme] = useState<UserTheme>(getStoredUserTheme);

	// Listen to system preference changes when in system mode
	useEffect(() => {
		if (userTheme !== "system") return;

		return setupSystemThemeListener(() => {
			handleThemeChange("system");
		});
	}, [userTheme]);



	const appTheme: AppTheme =
		userTheme === "system" ? getSystemTheme() : userTheme;

	const setTheme = (newUserTheme: UserTheme) => {
		setUserTheme(newUserTheme);
		setStoredTheme(newUserTheme);
		handleThemeChange(newUserTheme);
	};

	return (
		<ThemeContext value={{ userTheme, appTheme, setTheme }}>
			{children}
		</ThemeContext>
	);
}

export function useTheme() {
	const context = use(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
