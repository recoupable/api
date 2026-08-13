import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validatePostLeadsBody } from "@/lib/leads/validatePostLeadsBody";
import { captureLead } from "@/lib/leads/captureLead";

/**
 * Handler for POST /api/leads.
 *
 * A non-200 here means the lead was NOT stored — log-and-return-success is the
 * root cause chat#1800 exists to end, so an Attio failure is a 502 the caller
 * must surface, never a fake success. The upstream error detail is logged, not
 * echoed: the visitor gets a generic message, the operator gets the log line.
 *
 * @param request - The incoming request
 * @returns 200 with `{ status, notified, record_url }`, 400 on a bad body, or
 *   502 when the lead could not be stored.
 */
export async function postLeadsHandler(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const validated = validatePostLeadsBody(body);
  if (validated instanceof NextResponse) return validated;

  const result = await captureLead(validated);
  if (result.success === false) {
    console.error("[leads] capture failed:", result.error);
    return NextResponse.json(
      { status: "error", error: "We could not save this lead. Please try again." },
      { status: 502, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json(
    { status: "success", notified: result.notified, record_url: result.recordUrl },
    { status: 200, headers: getCorsHeaders() },
  );
}
