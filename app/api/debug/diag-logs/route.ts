import { NextRequest, NextResponse } from "next/server";
import { diagAppendEntries, diagGet, diagListKeys, type DiagEntry } from "@/lib/diag/inMemoryLog";
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

/**
 * POST /api/debug/diag-logs — append entries to the in-memory buffer.
 *
 * Used by workflow-side diagLog() callers to ship their entries to the api
 * instance so a subsequent GET on the same instance can read everything.
 *
 * @param request - JSON body `{ key: string, entries: DiagEntry[] }`.
 * @returns `{ ok: true, appended: number }` or `{ error }` 400 on bad shape.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400, headers: getCorsHeaders() });
  }
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { key?: unknown }).key !== "string" ||
    !Array.isArray((body as { entries?: unknown }).entries)
  ) {
    return NextResponse.json(
      { error: "expected { key: string, entries: DiagEntry[] }" },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  const { key, entries } = body as { key: string; entries: DiagEntry[] };
  diagAppendEntries(key, entries);
  return NextResponse.json({ ok: true, appended: entries.length }, { headers: getCorsHeaders() });
}
