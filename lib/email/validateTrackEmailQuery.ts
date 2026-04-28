import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const trackEmailQuerySchema = z.object({
  email: z.string({ message: "email is required" }).min(1, "email cannot be empty"),
});

export type TrackEmailQuery = z.infer<typeof trackEmailQuerySchema>;

/**
 * Validates query params for GET /api/email.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with an error if validation fails, or the validated query.
 */
export function validateTrackEmailQuery(request: NextRequest): NextResponse | TrackEmailQuery {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const result = trackEmailQuerySchema.safeParse(params);

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
