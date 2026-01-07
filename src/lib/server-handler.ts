/**
 * Type definitions for TanStack Start server route handlers.
 * Provides type-safe handlers that can be exported and tested directly.
 */

/**
 * Context passed to server route handlers.
 * TParams defaults to empty object for routes without dynamic segments.
 */
export interface RouteHandlerContext<TParams = Record<string, never>> {
	request: Request;
	params: TParams;
}

/**
 * Type for server route handlers (GET, POST, etc.)
 *
 * @example
 * // Route without params
 * export const GET: ServerRouteHandler = async ({ request }) => {
 *   return Response.json({ ok: true });
 * };
 *
 * @example
 * // Route with splat param
 * export const GET: ServerRouteHandler<{ _splat: string }> = async ({ request, params }) => {
 *   const path = params._splat;
 *   return Response.json({ path });
 * };
 */
export type ServerRouteHandler<TParams = Record<string, never>> = (
	ctx: RouteHandlerContext<TParams>,
) => Promise<Response>;
