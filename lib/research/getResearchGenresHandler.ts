import { type NextRequest } from "next/server";
import { handleResearchRequest } from "@/lib/research/handleResearchRequest";

/**
 * GET /api/research/genres
 *
 * Returns all available genre IDs and names.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchGenresHandler(request: NextRequest) {
  return handleResearchRequest(
    request,
    () => "/genres",
    undefined,
    data => ({ genres: Array.isArray(data) ? data : [] }),
  );
}
