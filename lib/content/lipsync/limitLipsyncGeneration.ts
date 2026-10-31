import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { consumeOAuthRateLimit } from "@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/** Reuse the durable minute counter, with the same per-tool budget as full MCP. */
export async function limitLipsyncGeneration(accountId: string): Promise<NextResponse | null> {
  try {
    const key = createHash("sha256").update(accountId).digest("hex");
    const namespace = createHash("sha256").update("content-lipsync-v1").digest("hex");
    const retry = await consumeOAuthRateLimit(namespace, [{ key, limit: 30 }]);
    if (!retry) return null;
    return NextResponse.json(
      { status: "error", error: "Lipsync rate limit reached" },
      {
        status: 429,
        headers: {
          ...getCorsHeaders(),
          "Access-Control-Expose-Headers": "Retry-After",
          "Retry-After": String(retry),
        },
      },
    );
  } catch {
    return NextResponse.json(
      { status: "error", error: "Generation throttling unavailable" },
      { status: 503, headers: getCorsHeaders() },
    );
  }
}
