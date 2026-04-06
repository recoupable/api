import { type NextRequest } from "next/server";
import { handleResearchRequest } from "@/lib/research/handleResearchRequest";

/**
 * GET /api/research/radio
 *
 * Returns a list of radio stations.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchRadioHandler(request: NextRequest) {
  return handleResearchRequest(
    request,
    () => "/radio/station-list",
    undefined,
    data => ({ stations: Array.isArray(data) ? data : [] }),
  );
}
