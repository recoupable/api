import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureEventsResearchCredits } from "@/lib/research/ensureEventsResearchCredits";
import { errorResponse } from "@/lib/networking/errorResponse";

const bodySchema = z.object({
  // The `error` option covers the missing/wrong-type case, which otherwise
  // surfaces Zod's default "expected string, received undefined" and never
  // tells the caller which field they left out.
  artist_id: z
    .string({ error: "artist_id is required and must be a valid UUID" })
    .uuid("artist_id must be a valid UUID"),
  date: z.enum(["upcoming", "past", "all"]).optional(),
});

export type ValidatedPostResearchEventsRequest = {
  accountId: string;
  orgId: string | null;
  artist_id: string;
  date?: "upcoming" | "past" | "all";
};

/**
 * Validates `POST /api/research/events` — auth, then body.
 *
 * Callers identify the artist by their Recoup `artist_id`; the provider id is
 * resolved server-side from the artist's connected socials. Keeping a provider
 * id out of the request means the events source can change without a breaking
 * contract change.
 *
 * @param request - JSON body with `artist_id` and optional `date`
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

  return {
    accountId: authResult.accountId,
    orgId: authResult.orgId,
    ...parsed.data,
  };
}
