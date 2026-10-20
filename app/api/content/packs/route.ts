import { NextRequest } from "next/server";
import { handlePackRequest } from "@/lib/content/packs/handlePackRequest";
/**
 * Prepare a private release pack without requiring an existing artist or repository.
 *
 * @param request - Authenticated HTTP request.
 * @returns Private pack state or a controlled error response.
 */
export function POST(request: NextRequest) {
  return handlePackRequest(request, "prepare");
}
