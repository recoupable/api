import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const getMusicQuerySchema = z.object({
  account_id: z.string().uuid().optional(),
  status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetMusicQuery = z.infer<typeof getMusicQuerySchema>;

/**
 * Validates query parameters for GET /api/music.
 *
 * @param searchParams - The request's query parameters.
 * @returns A NextResponse with a 400 if validation fails, or the validated query.
 */
export function validateGetMusicQuery(searchParams: URLSearchParams): NextResponse | GetMusicQuery {
  const result = getMusicQuerySchema.safeParse({
    account_id: searchParams.get("account_id") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", missing_fields: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
