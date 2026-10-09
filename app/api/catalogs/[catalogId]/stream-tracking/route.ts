import type { NextRequest } from "next/server";
import { catalogStreamsHandler } from "@/lib/catalog/catalogStreamsHandler";
/**
 * GET collection state, latest run and coverage.
 *
 * @param request - Incoming authenticated request.
 * @param context - Route context.
 * @param context.params - Authoritative catalog path parameters.
 * @returns The catalog response or an authentication/validation error.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ catalogId: string }> },
) {
  return catalogStreamsHandler(request, (await context.params).catalogId, "tracking");
}
/**
 * POST enable, disable or request today's idempotent refresh.
 *
 * @param request - Incoming authenticated request.
 * @param context - Route context.
 * @param context.params - Authoritative catalog path parameters.
 * @returns The catalog response or an authentication/validation error.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ catalogId: string }> },
) {
  return catalogStreamsHandler(request, (await context.params).catalogId, "tracking");
}
