import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
	plugins: [
		devtools(),
		// this is the plugin that enables path aliases
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		tanstackStart(),
		// Use node-server preset for Docker/production deployment
		// See: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
		nitro({
			preset: "node-server",
			// Ensure our Nitro startup plugins are included in the server bundle
			plugins: ["server/plugins/better-auth-auto-migrate.ts"],
		}),
		viteReact(),
	],
});

export default config;
