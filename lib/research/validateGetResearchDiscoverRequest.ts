import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { z } from "zod";

export const discoverQuerySchema = z.object({
  country: z.string().length(2, "country must be a 2-letter ISO code").optional(),
  genre: z.string().optional(),
  sort: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sp_monthly_listeners_min: z.coerce.number().int().min(0).optional(),
  sp_monthly_listeners_max: z.coerce.number().int().min(0).optional(),
});

export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;

export type ValidatedGetResearchDiscoverRequest = DiscoverQuery & { accountId: string };

/**
 * Validates `GET /api/research/discover` — auth + filter query params.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchDiscoverRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchDiscoverRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const key of [
    "country",
    "genre",
    "sort",
    "limit",
    "sp_monthly_listeners_min",
    "sp_monthly_listeners_max",
  ]) {
    const val = searchParams.get(key);
    if (val) raw[key] = val;
  }

  const result = discoverQuerySchema.safeParse(raw);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { accountId: authResult.accountId, ...result.data };
}
