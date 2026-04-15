import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

const bodySchema = z.object({
  query: z.string().min(1, "query is required"),
  max_results: z.coerce.number().int().min(1).max(20).optional(),
  country: z.string().length(2).optional(),
});

export type ValidatedPostResearchWebRequest = {
  accountId: string;
  query: string;
  max_results?: number;
  country?: string;
};

/**
 * Validates `POST /api/research/web` — auth + body (`query` required,
 * optional `max_results`, `country`).
 */
export async function validatePostResearchWebRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedPostResearchWebRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  return { accountId: authResult.accountId, ...parsed.data };
}
