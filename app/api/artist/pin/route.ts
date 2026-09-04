import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { toggleArtistPinHandler } from "@/lib/artist-pin/toggleArtistPinHandler";

/**
 * POST /api/artist/pin
 *
 * Toggles the pinned status of an artist for a given account.
 *
 * Body: { accountId: string, artistId: string, pinned: boolean }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { accountId, artistId, pinned } = body;

  return toggleArtistPinHandler({ accountId, artistId, pinned });
}

/**
 * OPTIONS handler for CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

export const dynamic = "force-dynamic";
