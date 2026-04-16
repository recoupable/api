import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

const bodySchema = z.object({
  query: z.string().min(1, "query is required"),
  num_results: z.coerce.number().int().min(1).max(100).optional(),
});

export type ValidatedPostResearchPeopleRequest = {
  accountId: string;
  query: string;
  num_results?: number;
};

/**
 * Validates `POST /api/research/people` — auth + body (`query` required,
 * optional `num_results`).
 */
export async function validatePostResearchPeopleRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedPostResearchPeopleRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  return { accountId: authResult.accountId, ...parsed.data };
}
