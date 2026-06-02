import { NextRequest, NextResponse } from "next/server";

/**
 * Gates `GET /api/internal/credit-spend-digest` to Vercel Cron only.
 *
 * Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to scheduled
 * invocations when `CRON_SECRET` is set. We require an exact match so the
 * internal route can't be triggered by arbitrary callers. A missing
 * `CRON_SECRET` is treated as a misconfiguration (500) rather than an open
 * door.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse to short-circuit on failure, or null when authorized.
 */
export function validateGetCreditSpendDigestRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[credit-spend-digest] CRON_SECRET is not configured");
    return NextResponse.json({ status: "error", message: "Server misconfigured" }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  return null;
}
