import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const postLeadBodySchema = z.object({
  email: z.string().email("email must be a valid email address"),
  source: z.string().min(1, "source is required"),
  name: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  package: z.string().optional(),
  rosterSize: z.string().optional(),
  message: z.string().optional(),
});

export type PostLeadBody = z.infer<typeof postLeadBodySchema>;

/**
 * Validates the request body for POST /api/notifications/lead.
 *
 * `source` is required rather than optional: a notification that cannot say
 * which form produced the lead cannot be triaged, which is the whole point of
 * the endpoint (recoupable/chat#1800).
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body.
 */
export function validatePostLeadBody(body: unknown): NextResponse | PostLeadBody {
  const result = postLeadBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
