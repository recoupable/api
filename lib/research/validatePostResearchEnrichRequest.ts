import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

const bodySchema = z.object({
  input: z.string().min(1, "input is required"),
  schema: z.record(z.string(), z.unknown()),
  processor: z.enum(["base", "core", "ultra"]).optional().default("base"),
});

export type ValidatedPostResearchEnrichRequest = {
  accountId: string;
  input: string;
  schema: Record<string, unknown>;
  processor: "base" | "core" | "ultra";
};

/**
 * Validates `POST /api/research/enrich` — auth + body (`input` and `schema`
 * required, optional `processor` defaulting to `"base"`).
 */
export async function validatePostResearchEnrichRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedPostResearchEnrichRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  return { accountId: authResult.accountId, ...parsed.data };
}
