import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postResearchEnrichHandler } from "@/lib/research/postResearchEnrichHandler";

/**
 * OPTIONS /api/research/enrich — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/research/enrich — Enrich an entity with structured web research data. Body: `{ url, prompt? }`.
 *
 * @param request - JSON body with `url` and optional `prompt`
 * @returns JSON enriched entity data or error
 */
export async function POST(request: NextRequest) {
  return postResearchEnrichHandler(request);
}
