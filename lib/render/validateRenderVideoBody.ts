import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

/**
 * Zod schema for the POST /api/video/render request body.
 *
 * Only `compositionId` is required. All other fields have sensible defaults
 * (720×1280, 30 fps, 240 frames = 8 seconds, h264 codec).
 */
export const renderVideoBodySchema = z.object({
  compositionId: z
    .string({ message: "compositionId is required" })
    .min(1, "compositionId cannot be empty"),
  inputProps: z.record(z.string(), z.unknown()).default({}),
  width: z.number().int().min(1).max(3840).default(720),
  height: z.number().int().min(1).max(3840).default(1280),
  fps: z.number().int().min(1).max(60).default(30),
  durationInFrames: z.number().int().min(1).max(1800).default(240),
  codec: z.enum(["h264", "h265", "vp8", "vp9"]).default("h264"),
});

/** Inferred type after successful validation. */
export type RenderVideoBody = z.infer<typeof renderVideoBodySchema>;

/**
 * Validates the request body for POST /api/video/render.
 *
 * @param body - The raw, parsed JSON body from the request.
 * @returns A `NextResponse` with a 400 error if validation fails,
 *          or the validated `RenderVideoBody` if validation passes.
 */
export function validateRenderVideoBody(body: unknown): NextResponse | RenderVideoBody {
  const result = renderVideoBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return result.data;
}
