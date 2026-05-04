import { NextRequest } from "next/server";
import { createSessionHandler } from "@/lib/sessions/createSessionHandler";

/**
 * `POST /api/sessions` — create a session and an initial chat.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ session, chat }` on 200, or an error.
 */
export async function POST(request: NextRequest) {
  return createSessionHandler(request);
}
