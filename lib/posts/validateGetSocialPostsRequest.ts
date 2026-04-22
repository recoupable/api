import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { checkAccountSocialAccess } from "@/lib/socials/checkAccountSocialAccess";

// latestFirst defaults to true; only the literal string "false" flips it.
// Preserves legacy Express behavior where any other value (absent, "0", "")
// is treated as true.
export const getSocialPostsParamsSchema = z.object({
  social_id: z.string().uuid("social_id must be a valid UUID"),
  latestFirst: z
    .string()
    .optional()
    .default("true")
    .transform(v => v !== "false")
    .pipe(z.boolean()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GetSocialPostsParams = z.infer<typeof getSocialPostsParamsSchema>;

// Legacy envelope for 400 responses mirrors the Express handler byte-for-byte:
// empty posts array and a zeroed pagination block. Inlined rather than using
// validationErrorResponse because that helper's shape is `missing_fields`-only.
const paginationValidationError = (error: string, missing_fields: PropertyKey[]): NextResponse =>
  NextResponse.json(
    {
      status: "error",
      missing_fields,
      error,
      posts: [],
      pagination: { total_count: 0, page: 1, limit: 20, total_pages: 0 },
    },
    { status: 400, headers: getCorsHeaders() },
  );

const errorEnvelope = (status: number, error: string): NextResponse =>
  NextResponse.json({ status: "error", error }, { status, headers: getCorsHeaders() });

export async function validateGetSocialPostsRequest(
  request: NextRequest,
  id: string,
): Promise<GetSocialPostsParams | NextResponse> {
  const { searchParams } = new URL(request.url);
  const parsed = getSocialPostsParamsSchema.safeParse({
    social_id: id,
    latestFirst: searchParams.get("latestFirst") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return paginationValidationError(issue.message, issue.path);
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { social_id } = parsed.data;

  const socials = await selectSocials({ id: social_id });
  if (!socials || !socials.length) {
    return errorEnvelope(404, `Social profile not found for id: ${social_id}`);
  }

  const hasAccess = await checkAccountSocialAccess(authResult.accountId, social_id);
  if (!hasAccess) {
    return errorEnvelope(403, "Unauthorized social posts access");
  }

  return parsed.data;
}
