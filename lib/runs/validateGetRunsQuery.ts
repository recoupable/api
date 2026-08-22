import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

// `kind` is a required enum: future run kinds are new values here, never new
// endpoints (chat#1973 decision).
export const getRunsQuerySchema = z.object({
  kind: z.enum(["valuation", "music"], { message: "kind must be one of: valuation, music" }),
  limit: z.coerce.number().int().min(1).max(20).default(1),
});

export type GetRunsQuery = z.infer<typeof getRunsQuerySchema>;

/**
 * Validates query parameters for GET /api/runs.
 *
 * @param searchParams - The request's query parameters
 * @returns A NextResponse with an error if validation fails, or the validated query.
 */
export function validateGetRunsQuery(searchParams: URLSearchParams): NextResponse | GetRunsQuery {
  const result = getRunsQuerySchema.safeParse({
    kind: searchParams.get("kind") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

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
