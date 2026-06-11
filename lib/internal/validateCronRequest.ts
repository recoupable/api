import { NextRequest, NextResponse } from "next/server";

/**
 * Gates an internal route to Vercel Cron only. Vercel attaches
 * `Authorization: Bearer ${CRON_SECRET}` to scheduled invocations; we require
 * an exact match. A missing `CRON_SECRET` is a misconfiguration (500), not an
 * open door.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse to short-circuit on failure, or null when authorized.
 */
export function validateCronRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[internal-cron] CRON_SECRET is not configured");
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  return null;
}
