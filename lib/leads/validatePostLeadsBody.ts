import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

// Shared by every capture surface. `source` is required rather than optional:
// an unattributable lead cannot be triaged, which is the whole point of
// capturing it (recoupable/chat#1800).
const commonFields = {
  email: z.string().email("email must be a valid email address"),
  source: z.string().min(1, "source is required"),
  company: z.string().optional(),
};

const bookingSchema = z.object({
  kind: z.literal("booking"),
  ...commonFields,
  // The booking form requires a name and a package — the two fields that make
  // an advisory enquiry actionable.
  name: z.string().min(1, "name is required"),
  package: z.string().min(1, "package is required"),
  role: z.string().optional(),
  rosterSize: z.string().optional(),
  message: z.string().optional(),
});

const subscribeSchema = z.object({
  kind: z.literal("subscribe"),
  ...commonFields,
  name: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  source_post_slug: z.string().optional(),
  // The qualifying payloads previously stripped by marketing's schema
  // (chat#1800, superseded marketing#71) — a completed audit is the most
  // qualified lead the marketing site produces.
  audit_answers: z.record(z.string(), z.unknown()).optional(),
  audit_score: z.union([z.string(), z.number()]).optional(),
  roi_inputs: z.record(z.string(), z.unknown()).optional(),
  roi_results: z.record(z.string(), z.unknown()).optional(),
});

export const postLeadsBodySchema = z.discriminatedUnion("kind", [bookingSchema, subscribeSchema]);

export type PostLeadsBody = z.infer<typeof postLeadsBodySchema>;
export type BookingLead = z.infer<typeof bookingSchema>;
export type SubscribeLead = z.infer<typeof subscribeSchema>;

/**
 * Validates the request body for POST /api/leads.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body.
 */
export function validatePostLeadsBody(body: unknown): NextResponse | PostLeadsBody {
  const result = postLeadsBodySchema.safeParse(body);

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
