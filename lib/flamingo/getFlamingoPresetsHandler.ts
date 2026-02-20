import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPresetSummaries } from "@/lib/flamingo/presets";

/**
 * Handler for GET /api/music/presets.
 *
 * Returns a list of all available analysis presets.
 * No authentication required — this is a discovery endpoint.
 *
 * @returns A NextResponse with the list of available presets.
 */
export async function getFlamingoPresetsHandler(): Promise<NextResponse> {
  const presets = getPresetSummaries();

  return NextResponse.json(
    {
      status: "success",
      presets,
    },
    {
      status: 200,
      headers: getCorsHeaders(),
    },
  );
}
