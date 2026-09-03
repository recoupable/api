import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export const createVideoBodySchema = z.object({
  prompt: z.string().min(1).max(50000),
  prompt_expansion_mode: z.enum(["balanced", "quality"]).optional().default("balanced"),
  image_url: z.string().url().optional(),
  end_image_url: z.string().url().optional(),
  duration: z.number().int().min(5).max(15).optional().default(5),
  resolution: z.enum(["480P", "768P"]).optional().default("768P"),
  seed: z.number().int().optional(),
  enable_safety_checker: z.boolean().optional().default(true),
  sync_mode: z.boolean().optional().default(false),
});

export type ValidatedCreateVideoBody = { accountId: string } & z.infer<
  typeof createVideoBodySchema
>;

/**
 * Validates auth and request body for POST /api/content/video.
 */
export async function validateCreateVideoBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateVideoBody> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await safeParseJson(request);
  const result = createVideoBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", field: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { accountId: authResult.accountId, ...result.data };
}
