import { NextRequest, NextResponse } from "next/server";
import { diagAppendEntries, diagGet, diagListKeys, type DiagEntry } from "@/lib/diag/inMemoryLog";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * OPTIONS for CORS preflight.
 *
 * @returns Empty 200 with CORS headers.
 */
export function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/debug/diag-logs?chatId={uuid} — read in-memory diag entries.
 *
 * @param request - GET request.
 * @returns JSON entries or 400 on missing chatId.
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
 * POST — workflow-side diag forwarder.
 *
 * @param request - POST with `{ key, entries }`.
 * @returns Append result or 400.
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
