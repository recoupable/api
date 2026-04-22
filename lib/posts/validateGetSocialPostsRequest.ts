import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";
import { paginationQuerySchema } from "@/lib/zod/paginationQuerySchema";
import { errorResponse } from "@/lib/networking/errorResponse";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { checkAccountSocialAccess } from "@/lib/socials/checkAccountSocialAccess";

// latestFirst defaults to true; only the literal string "false" flips it.
// Preserves legacy Express behavior where any other value (absent, "0", "")
// is treated as true.
export const getSocialPostsParamsSchema = paginationQuerySchema().extend({
  social_id: z.string({ error: "id is required" }).uuid("id must be a valid UUID"),
  latestFirst: z.preprocess(v => v !== "false", z.boolean()),
});

export type GetSocialPostsParams = z.infer<typeof getSocialPostsParamsSchema>;

/**
 * Bundles auth, path-id + query parsing, social existence (404), and
 * social-access check (403) so the handler stays a thin orchestration shell.
 */
export async function validateGetSocialPostsRequest(
  request: NextRequest,
  id: string,
): Promise<GetSocialPostsParams | NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const parsed = getSocialPostsParamsSchema.safeParse({
    social_id: id,
    latestFirst: searchParams.get("latestFirst") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return validationErrorResponse(firstError.message, firstError.path);
  }

  const socials = await selectSocials({ id: parsed.data.social_id });
  if (!socials || !socials.length) return errorResponse("Social not found", 404);

  const hasAccess = await checkAccountSocialAccess(authResult.accountId, parsed.data.social_id);
  if (!hasAccess) return errorResponse("Unauthorized", 403);

  return parsed.data;
}
