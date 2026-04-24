import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { WebhookUpdateData } from "apify-client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export const GetInstagramCommentsParamsSchema = z.object({
  postUrls: z.array(z.string().min(1)).min(1, "postUrls must include at least one value"),
  resultsLimit: z.coerce.number().int().positive().optional().default(10000),
  isNewestComments: z.boolean().optional(),
  webhooks: z.array(z.custom<WebhookUpdateData>()).optional(),
});

export type GetInstagramCommentsParams = z.infer<typeof GetInstagramCommentsParamsSchema>;

function badRequest(error: string): NextResponse {
  return NextResponse.json({ status: "error", error }, { status: 400, headers: getCorsHeaders() });
}

export async function validateGetInstagramCommentsRequest(
  request: NextRequest,
): Promise<GetInstagramCommentsParams | NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(request.url);
  const postUrls = url.searchParams.getAll("postUrls");
  const resultsLimitParam = url.searchParams.get("resultsLimit") ?? undefined;
  const isNewestParam = url.searchParams.get("isNewestComments");
  const webhooksParam = url.searchParams.get("webhooks");

  let webhooks: readonly WebhookUpdateData[] | undefined;
  if (webhooksParam) {
    try {
      const decoded = Buffer.from(webhooksParam, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      if (!Array.isArray(parsed)) {
        return badRequest("webhooks must decode to an array");
      }
      webhooks = parsed as WebhookUpdateData[];
    } catch {
      return badRequest("webhooks must be a base64-encoded JSON array");
    }
  }

  let isNewestComments: boolean | undefined;
  if (isNewestParam !== null) {
    if (isNewestParam === "true") isNewestComments = true;
    else if (isNewestParam === "false") isNewestComments = false;
    else return badRequest("isNewestComments must be 'true' or 'false'");
  }

  const result = GetInstagramCommentsParamsSchema.safeParse({
    postUrls,
    resultsLimit: resultsLimitParam,
    isNewestComments,
    webhooks,
  });
  if (!result.success) {
    return badRequest(result.error.issues[0]?.message ?? "Invalid query parameters");
  }

  return result.data;
}
