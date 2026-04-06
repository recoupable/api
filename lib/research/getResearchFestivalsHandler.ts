import { type NextRequest } from "next/server";
import { handleResearchRequest } from "@/lib/research/handleResearchRequest";

/**
 * GET /api/research/festivals
 *
 * Returns a list of music festivals.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchFestivalsHandler(request: NextRequest) {
  return handleResearchRequest(
    request,
    () => "/festival/list",
    undefined,
    data => ({ festivals: Array.isArray(data) ? data : [] }),
  );
}
