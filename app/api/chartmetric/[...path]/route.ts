import { type NextRequest } from "next/server";
import { proxyChartmetricRequest } from "@/lib/chartmetric/proxyChartmetricRequest";

/**
 * GET /api/chartmetric/[...path]
 *
 * Proxies GET requests to the Chartmetric API on behalf of an authenticated account.
 * Deducts 1 credit per call.
 *
 * @param request - Incoming API request.
 * @param context - Route context containing the Chartmetric path segments.
 * @param context.params - Route params with Chartmetric path segments.
 * @param context.params.path - Array of path segments to forward to Chartmetric.
 * @returns The Chartmetric API response.
 */
export async function GET(request: NextRequest, context: { params: { path: string[] } }) {
  return proxyChartmetricRequest(request, context.params);
}

/**
 * POST /api/chartmetric/[...path]
 *
 * Proxies POST requests to the Chartmetric API on behalf of an authenticated account.
 * Deducts 1 credit per call.
 *
 * @param request - Incoming API request.
 * @param context - Route context containing the Chartmetric path segments.
 * @param context.params - Route params with Chartmetric path segments.
 * @param context.params.path - Array of path segments to forward to Chartmetric.
 * @returns The Chartmetric API response.
 */
export async function POST(request: NextRequest, context: { params: { path: string[] } }) {
  return proxyChartmetricRequest(request, context.params);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
