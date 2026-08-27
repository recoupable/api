import type { NextRequest } from "next/server";

/**
 * The `model_id` written on a usage event for a charge that is an API call
 * rather than a model turn: `"<METHOD> <route pattern>"`, e.g.
 * `"POST /api/artist/socials/scrape"`. The route pattern is the literal
 * `app/api/...` path (with `[id]` segments), never the concrete URL, so the
 * same endpoint always groups under one value (recoupable/app#2029).
 *
 * @param request - The incoming request; supplies the method.
 * @param routePattern - The route's path pattern, as written under `app/api`.
 * @returns The endpoint label for `usage_events.model_id`.
 */
export function endpointModelId(request: NextRequest, routePattern: string): string {
  return `${request.method} ${routePattern}`;
}
