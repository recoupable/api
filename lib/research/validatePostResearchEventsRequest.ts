import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureEventsResearchCredits } from "@/lib/research/ensureEventsResearchCredits";
import { errorResponse } from "@/lib/networking/errorResponse";

const bodySchema = z.object({
  bandsintown_id: z
    .string()
    .regex(/^\d+$/, "bandsintown_id must be a numeric Bandsintown artist id"),
  date: z.enum(["upcoming", "past", "all"]).optional(),
});

export type ValidatedPostResearchEventsRequest = {
  accountId: string;
  bandsintown_id: string;
  date?: "upcoming" | "past" | "all";
};

/**
 * Validates `POST /api/research/events` — auth, then body.
 *
 * `bandsintown_id` is constrained to digits on purpose. The whole point of this
 * endpoint is that the artist is identified exactly rather than resolved from a
 * name, so accepting a free-text value would quietly reintroduce the ambiguity
 * the endpoint exists to remove.
 *
 * @param request - JSON body with `bandsintown_id` and optional `date`
 * @returns The validated request, or a NextResponse to return directly
 */
export async function validatePostResearchEventsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedPostResearchEventsRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const short = await ensureEventsResearchCredits(authResult.accountId);
  if (short) return short;

  return { accountId: authResult.accountId, ...parsed.data };
}
