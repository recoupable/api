import { NextRequest, NextResponse } from "next/server";

/**
 * Gates an internal route to trusted server-to-server callers — currently the
 * marketing site posting lead notifications. Callers send
 * `Authorization: Bearer ${INTERNAL_API_SECRET}`; we require an exact match.
 *
 * Mirrors `validateCronRequest`, including its stance that a missing secret is
 * a misconfiguration (500) rather than an open door. Kept separate from it
 * because these callers are not Vercel Cron and must not share CRON_SECRET.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse to short-circuit on failure, or null when authorized.
 */
export function validateInternalRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error("[internal] INTERNAL_API_SECRET is not configured");
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
