import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";
import { elevenLabsOutputFormatSchema } from "./outputFormats";

export const stemSeparationBodySchema = z.object({
  stem_variation_id: z
    .enum(["two_stems_v1", "six_stems_v1"])
    .optional()
    .default("six_stems_v1"),
  sign_with_c2pa: z.boolean().optional().default(false),
  output_format: elevenLabsOutputFormatSchema.optional(),
});

export type StemSeparationBody = z.infer<typeof stemSeparationBodySchema>;

/**
 * Validates the text fields for POST /api/music/stem-separation.
 * The audio file is validated separately during form parsing.
 *
 * @param body - The raw text fields from multipart form data.
 * @returns Validated data or a NextResponse error.
 */
export function validateStemSeparationBody(body: unknown): NextResponse | StemSeparationBody {
  const result = stemSeparationBodySchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", missing_fields: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  return result.data;
}
