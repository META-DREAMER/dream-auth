import { createRouter } from "@tanstack/react-router";
import { parseSearch, stringifySearch } from "@/lib/search-params";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const getRouter = () => {
	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreloadStaleTime: 0,
		// Keep the query string as the server wrote it: the OAuth login page
		// carries a signed query that must survive hydration. See
		// src/lib/search-params.ts.
		parseSearch,
		stringifySearch,
	});

	return router;
};
