import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

type Handler = (request: NextRequest) => Promise<NextResponse>;

/**
 * Creates the standard OPTIONS + POST exports for a content primitive route.
 * Route segment config (dynamic, fetchCache, revalidate) must still be
 * exported directly from the route file — Next.js requires static analysis.
 *
 * @param handler - The POST handler function for the route.
 * @returns Object with OPTIONS and POST exports.
 */
export function createPrimitiveRoute(handler: Handler) {
  return {
    OPTIONS: async () => new NextResponse(null, { status: 204, headers: getCorsHeaders() }),
    POST: handler,
  };
}
