import { NextRequest } from "next/server";
import { handlePackRequest } from "@/lib/content/packs/handlePackRequest";
/**
 * Import selected audio or imagery into the authenticated workspace's private storage.
 *
 * @param request - Authenticated HTTP request.
 * @returns Private pack state or a controlled error response.
 */
export function POST(request: NextRequest) {
  return handlePackRequest(request, "upload");
}
