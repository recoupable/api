import { NextRequest } from "next/server";
import { guestContextHandler } from "@/lib/context/guest/guestContextHandler";
/**
 * Start or resume metadata extraction for the current guest session.
 *
 * @param request - Incoming context request.
 * @returns The context operation response.
 */
export async function POST(request: NextRequest) {
  return guestContextHandler(request);
}
/**
 * Read unclaimed, unexpired context belonging to the guest session.
 *
 * @param request - Incoming context request.
 * @returns The context operation response.
 */
export async function GET(request: NextRequest) {
  return guestContextHandler(request);
}
