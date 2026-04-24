import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { WebhookUpdateData } from "apify-client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export const getInstagramProfilesParamsSchema = z.object({
  handles: z.array(z.string().min(1)).min(1, "handles must include at least one value"),
  webhooks: z.array(z.custom<WebhookUpdateData>()).optional(),
});

export type GetInstagramProfilesParams = z.infer<typeof getInstagramProfilesParamsSchema>;

function badRequest(error: string): NextResponse {
  return NextResponse.json({ status: "error", error }, { status: 400, headers: getCorsHeaders() });
}

export async function validateGetInstagramProfilesRequest(
  request: NextRequest,
): Promise<GetInstagramProfilesParams | NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(request.url);
  const handles = url.searchParams.getAll("handles");
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

  const result = getInstagramProfilesParamsSchema.safeParse({ handles, webhooks });
  if (!result.success) {
    return badRequest(result.error.issues[0]?.message ?? "Invalid query parameters");
  }

  return result.data;
}
