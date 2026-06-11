import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSnapshotHandler } from "@/lib/research/playcounts/createSnapshotHandler";

export const maxDuration = 60;

/**
 * OPTIONS /api/research/snapshots — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/research/snapshots — snapshot platform-displayed play counts for
 * a catalog / album list / ISRC list. Returns 202 with `snapshot_id` and a
 * cost estimate before any scraper spend; 429 at the per-org monthly cap.
 *
 * @param request - body: exactly one of catalog_id / album_ids / isrcs
 * @returns JSON snapshot job or error
 */
export async function POST(request: NextRequest) {
  return createSnapshotHandler(request);
}
