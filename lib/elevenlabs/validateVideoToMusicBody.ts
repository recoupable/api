import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";
import { elevenLabsOutputFormatSchema } from "./outputFormats";

export const videoToMusicBodySchema = z.object({
  description: z.string().min(1).max(1000).nullable().optional(),
  tags: z.array(z.string()).max(10).optional(),
  sign_with_c2pa: z.boolean().optional().default(false),
  output_format: elevenLabsOutputFormatSchema.optional(),
});

export type VideoToMusicBody = z.infer<typeof videoToMusicBodySchema>;

/**
 * Validates the text fields for POST /api/music/video-to-music.
 * The video file itself is validated separately during form parsing.
 *
 * @param body - The raw text fields from multipart form data.
 * @returns Validated data or a NextResponse error.
 */
export function validateVideoToMusicBody(body: unknown): NextResponse | VideoToMusicBody {
  const result = videoToMusicBodySchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", missing_fields: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  return result.data;
}
