import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export const createAudioBodySchema = z.object({
  audio_urls: z.array(z.string().url()).min(1),
  language: z.string().optional().default("en"),
  chunk_level: z.enum(["none", "segment", "word"]).optional().default("word"),
  diarize: z.boolean().optional().default(false),
  model: z.string().optional(),
});

export type ValidatedTranscribeAudioBody = { accountId: string } & z.infer<
  typeof createAudioBodySchema
>;

/**
 * Validates auth and request body for POST /api/content/transcribe.
 */
export async function validateTranscribeAudioBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedTranscribeAudioBody> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await safeParseJson(request);
  const result = createAudioBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", field: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { accountId: authResult.accountId, ...result.data };
}
