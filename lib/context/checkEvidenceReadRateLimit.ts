import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { consumeOAuthRateLimit } from "@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/** Shared GET budget per authenticated account, independent of cursor or workspace. */
export async function checkEvidenceReadRateLimit(accountId: string) {
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    const retry = await consumeOAuthRateLimit(hash("context-evidence-read:v1"), [
      { key: hash(`context-evidence-read:${accountId}`), limit: 120 },
    ]);
    return retry > 0
      ? NextResponse.json(
          { error: "Too many evidence requests. Try again later." },
          {
            status: 429,
            headers: { ...headers, "Retry-After": String(retry) },
          },
        )
      : null;
  } catch {
    return NextResponse.json(
      { error: "Evidence request throttling unavailable. Try again later." },
      {
        status: 503,
        headers,
      },
    );
  }
}
