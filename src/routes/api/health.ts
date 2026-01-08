import { createFileRoute } from "@tanstack/react-router";
import type { ServerRouteHandler } from "@/lib/server-handler";

export const GET: ServerRouteHandler = async () => {
	return Response.json({
		status: "ok",
		timestamp: new Date().toISOString(),
	});
};

export const Route = createFileRoute("/api/health")({
	server: {
		handlers: { GET },
	},
});
