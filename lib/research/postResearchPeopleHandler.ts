import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { searchPeople } from "@/lib/exa/searchPeople";

const bodySchema = z.object({
  query: z.string().min(1, "query is required"),
  num_results: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * POST /api/research/people
 *
 * Search for people in the music industry — artists, managers,
 * A&R reps, producers, etc. Uses multi-source people data
 * including LinkedIn profiles.
 *
 * @param request - Body: { query, num_results? }
 * @returns JSON success or error response
 */
export async function postResearchPeopleHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;
  const { accountId } = authResult;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "Invalid request body";
    return NextResponse.json(
      { status: "error", error: message ?? "Invalid request body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  try {
    const result = await searchPeople(body.query, body.num_results ?? 10);

    try {
      await deductCredits({ accountId, creditsToDeduct: 5 });
    } catch {
      // Credit deduction failed but data was fetched — log but don't block
    }

    return NextResponse.json(
      {
        status: "success",
        results: result.results,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "People search failed",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
