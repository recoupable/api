import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { checkAccountSocialAccess } from "@/lib/socials/checkAccountSocialAccess";

export const postSocialScrapeParamsSchema = z.object({
  social_id: z.string().uuid("social_id must be a valid UUID"),
});

export type PostSocialScrapeParams = z.infer<typeof postSocialScrapeParamsSchema>;

const errorResponse = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: getCorsHeaders() });

export async function validatePostSocialScrapeRequest(
  request: NextRequest,
  id: string,
): Promise<PostSocialScrapeParams | NextResponse> {
  const parsed = postSocialScrapeParamsSchema.safeParse({ social_id: id });
  if (!parsed.success) {
    return errorResponse(400, {
      status: "error",
      missing_fields: parsed.error.issues[0].path,
      error: parsed.error.issues[0].message,
    });
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const social_id = parsed.data.social_id;

  const socials = await selectSocials({ id: social_id });
  if (!socials || !socials.length) {
    return errorResponse(404, {
      status: "error",
      error: `Social profile not found for id: ${social_id}`,
    });
  }

  const hasAccess = await checkAccountSocialAccess(authResult.accountId, social_id);
  if (!hasAccess) {
    return errorResponse(403, {
      status: "error",
      error: "Unauthorized social scrape attempt",
    });
  }

  return { social_id };
}
