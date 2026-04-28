import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getLoopsClient } from "@/lib/email/loopsClient";
import { validateTrackEmailBody } from "@/lib/email/validateTrackEmailBody";

/**
 * Handles POST /api/email — fire-and-forget Loops contact tracking.
 *
 * Mirrors the chat-side response shape exactly so callers can migrate
 * with a single base-URL swap.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ success, message, id }` on 200 or `{ message }` on 400.
 */
export async function trackEmailHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateTrackEmailBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const resp = await getLoopsClient().updateContact({ email: validated.email });
    return NextResponse.json(
      {
        success: resp.success,
        message: "",
        id: resp.id || "",
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("/api/email error", error);
    return NextResponse.json(
      { message: "Internal server error" },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }
}
