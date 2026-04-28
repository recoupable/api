import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const trackEmailBodySchema = z.object({
  email: z.string({ message: "email is required" }).email("email must be a valid email"),
});

export type TrackEmailBody = z.infer<typeof trackEmailBodySchema>;

/**
 * Validates request body for POST /api/email.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with an error if validation fails, or the validated body.
 */
export async function validateTrackEmailBody(
  request: NextRequest,
): Promise<NextResponse | TrackEmailBody> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const result = trackEmailBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return result.data;
}
