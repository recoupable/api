import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Checks for FAL_KEY and configures the fal client.
 * Returns null on success, or a 500 NextResponse if the key is missing.
 *
 * @returns Null if configured, or an error NextResponse.
 */
export function configureFal(): NextResponse | null {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      { status: "error", error: "FAL_KEY is not configured" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
  fal.config({ credentials: falKey });
  return null;
}
