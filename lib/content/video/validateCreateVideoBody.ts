import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { TEMPLATE_IDS } from "@/lib/content/templates";

export const createVideoBodySchema = z.object({
  template: z.enum(TEMPLATE_IDS).optional(),
  mode: z.enum(["prompt", "animate", "reference", "extend", "first-last", "lipsync"]).optional(),
  prompt: z.string().optional(),
  image_url: z.string().url().optional(),
  end_image_url: z.string().url().optional(),
  video_url: z.string().url().optional(),
  audio_url: z.string().url().optional(),
  aspect_ratio: z.enum(["auto", "16:9", "9:16"]).optional().default("auto"),
  duration: z.enum(["4s", "6s", "7s", "8s"]).optional().default("8s"),
  resolution: z.enum(["720p", "1080p", "4k"]).optional().default("720p"),
  negative_prompt: z.string().optional(),
  generate_audio: z.boolean().optional().default(false),
  model: z.string().optional(),
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
