import { NextRequest, NextResponse } from "next/server";
import { diagGet, diagListKeys } from "@/lib/diag/inMemoryLog";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * OPTIONS handler for CORS preflight.
 *
 * @returns Empty 200 response with CORS headers.
 */
export function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/debug/diag-logs?chatId={uuid}
 *
 * Returns the in-memory diagnostic entries for the given chatId on the
 * serverless instance that handled the read. Empty if the chatId is unknown
 * (e.g. write and read landed on different instances). Intended for preview
 * debugging only — no auth, no persistence.
 *
 * Returns `?keys` (no chatId) to list known keys on this instance.
 *
 * @param request - The incoming GET request.
 * @returns JSON `{ chatId, count, entries }` for a chatId; `{ keys }` for the keys mode; or `{ error }` 400 when neither is provided.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  if (url.searchParams.has("keys")) {
    return NextResponse.json({ keys: diagListKeys() }, { headers: getCorsHeaders() });
  }
  const chatId = url.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json(
      { error: "chatId required (or ?keys to list)" },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  const entries = diagGet(chatId);
  return NextResponse.json(
    { chatId, count: entries.length, entries },
    { headers: getCorsHeaders() },
  );
}
