import { NextRequest } from "next/server";
import { guestContextHandler } from "@/lib/context/guest/guestContextHandler";
/**
 * Attach guest work to the verified account or authorized organization.
 *
 * @param request - Incoming context request.
 * @returns The context operation response.
 */
export async function POST(request: NextRequest) {
  return guestContextHandler(request, true);
}
