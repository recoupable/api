import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { POST_PLATFORMS, POST_STATUSES } from "@/lib/publishing/const";

export const getPostsQuerySchema = z.object({
  account_id: z.string().uuid().optional(),
  status: z.enum(POST_STATUSES).optional(),
  platform: z.enum(POST_PLATFORMS).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetPostsQuery = z.infer<typeof getPostsQuerySchema>;

/**
 * Validates query parameters for GET /api/posts.
 *
 * @param searchParams - The request's query parameters.
 * @returns A NextResponse with a 400 if validation fails, or the validated query.
 */
export function validateGetPostsQuery(searchParams: URLSearchParams): NextResponse | GetPostsQuery {
  const result = getPostsQuerySchema.safeParse({
    account_id: searchParams.get("account_id") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    platform: searchParams.get("platform") ?? undefined,
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
