import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export const createAnalyzeBodySchema = z.object({
  video_url: z.string().url(),
  prompt: z.string().min(1).max(2000),
  temperature: z.number().min(0).max(1).optional().default(0.2),
  max_tokens: z.number().int().min(1).max(4096).optional(),
});

export type ValidatedAnalyzeVideoBody = { accountId: string } & z.infer<
  typeof createAnalyzeBodySchema
>;

/**
 * Validate Analyze Video Body.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
 */
export async function validateAnalyzeVideoBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedAnalyzeVideoBody> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await safeParseJson(request);
  const result = createAnalyzeBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", field: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { accountId: authResult.accountId, ...result.data };
}
