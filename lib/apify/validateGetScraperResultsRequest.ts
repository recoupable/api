import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export const getScraperResultsParamsSchema = z.object({
  runId: z.string().min(1),
});

export type GetScraperResultsParams = z.infer<typeof getScraperResultsParamsSchema>;

/**
 * Authenticates the request (any valid API key or Bearer token), then
 * validates the runId path param.
 *
 * Deliberately not owner-scoped (chat#1840 decision, 2026-07-03): scrape
 * datasets are public social content and Apify run ids are unguessable,
 * so possession of a runId plus any valid credential is sufficient.
 * Authentication still gates the endpoint so anonymous callers can't use
 * it as a free Apify proxy.
 */
export async function validateGetScraperResultsRequest(
  request: NextRequest,
  runId: string,
): Promise<GetScraperResultsParams | NextResponse> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const parsed = getScraperResultsParamsSchema.safeParse({ runId });
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", error: "Missing or invalid runId parameter" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return parsed.data;
}
