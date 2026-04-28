import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

/**
 * Schema for `POST /api/apify` webhook bodies. Only validates the
 * fields we branch on + read downstream (`actorId` for dispatch,
 * `defaultDatasetId` for fetch). Extra keys are stripped so upstream
 * schema drift does not drop events.
 */
export const apifyBodySchema = z.object({
  eventData: z.object({
    actorId: z.string({ message: "eventData.actorId is required" }),
  }),
  resource: z.object({
    defaultDatasetId: z.string({ message: "resource.defaultDatasetId is required" }),
  }),
});

export type ApifyBody = z.infer<typeof apifyBodySchema>;

/**
 * Validates request body for POST /api/apify.
 *
 * The route's contract with Apify is to always reply 2xx so Apify does
 * not retry, so the failure NextResponse uses status 200 with the
 * project-standard error body shape.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the
 *   validated body if validation passes.
 */
export function validateApifyBody(body: unknown): NextResponse | ApifyBody {
  const result = apifyBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  }

  return result.data;
}
