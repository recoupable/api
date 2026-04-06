import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { enrichEntity } from "@/lib/parallel/enrichEntity";

const bodySchema = z.object({
  input: z.string().min(1, "input is required"),
  schema: z.record(z.string(), z.unknown()),
  processor: z.enum(["base", "core", "ultra"]).optional().default("base"),
});

/**
 * POST /api/research/enrich
 *
 * Enrich an entity with structured data from web research.
 * Provide a description of who/what to research and a JSON schema
 * defining what fields to extract. Returns typed data with citations.
 *
 * @param request - Body: { input, schema, processor? }
 * @returns JSON success or error response
 */
export async function postResearchEnrichHandler(request: NextRequest): Promise<NextResponse> {
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

  const creditCost = body.processor === "ultra" ? 25 : body.processor === "core" ? 10 : 5;

  try {
    const result = await enrichEntity(body.input, body.schema, body.processor);

    if (result.status === "timeout") {
      return NextResponse.json(
        {
          status: "error",
          error: "Enrichment timed out. Try a simpler schema or use processor: 'base'.",
          run_id: result.run_id,
        },
        { status: 504, headers: getCorsHeaders() },
      );
    }

    try {
      await deductCredits({ accountId, creditsToDeduct: creditCost });
    } catch {
      // Credit deduction failed but data was fetched — log but don't block
    }

    return NextResponse.json(
      {
        status: "success",
        output: result.output,
        citations: result.citations,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Enrichment failed",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
