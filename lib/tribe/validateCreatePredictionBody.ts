import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const createPredictionBodySchema = z.object({
  file_url: z
    .string({ message: "file_url is required" })
    .url("file_url must be a valid URL"),
  modality: z.enum(["video", "audio", "text"], {
    message: "modality must be video, audio, or text",
  }),
});

export type CreatePredictionBody = z.infer<typeof createPredictionBodySchema>;

/**
 * Validates request body for POST /api/predictions.
 *
 * @param body - The request body.
 * @returns A NextResponse with an error if validation fails, or the validated body.
 */
export function validateCreatePredictionBody(
  body: unknown,
): NextResponse | CreatePredictionBody {
  const result = createPredictionBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
