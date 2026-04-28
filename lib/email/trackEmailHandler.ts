import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { loopsClient } from "@/lib/email/loopsClient";
import { validateTrackEmailQuery } from "@/lib/email/validateTrackEmailQuery";

interface LoopsUpdateContactResponse {
  success: boolean;
  id?: string;
  message?: string;
}

/**
 * Handles GET /api/email — fire-and-forget Loops contact tracking.
 *
 * Mirrors the chat-side response shape exactly so callers can migrate
 * with a single base-URL swap.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ success, message, id }` on 200 or `{ message }` on 400.
 */
export async function trackEmailHandler(request: NextRequest): Promise<NextResponse> {
  const validated = validateTrackEmailQuery(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const resp: LoopsUpdateContactResponse = await loopsClient.updateContact(validated.email, {});
    return NextResponse.json(
      {
        success: resp.success,
        message: resp.message || "",
        id: resp.id || "",
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("/api/email error", error);
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json(
      { message },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }
}
