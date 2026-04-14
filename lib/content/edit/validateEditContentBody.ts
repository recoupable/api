import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { TEMPLATE_IDS } from "@/lib/content/templates";

export const editOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("trim"),
    start: z.number().nonnegative(),
    duration: z.number().positive(),
  }),
  z.object({
    type: z.literal("crop"),
    aspect: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("resize"),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("overlay_text"),
    content: z.string().min(1),
    font: z.string().optional(),
    color: z.string().optional().default("white"),
    stroke_color: z.string().optional().default("black"),
    max_font_size: z.number().positive().optional().default(42),
    position: z.enum(["top", "center", "bottom"]).optional().default("bottom"),
  }),
]);

export const editBodySchema = z
  .object({
    video_url: z.string().url(),
    template: z.enum(TEMPLATE_IDS).optional(),
    operations: z.array(editOperationSchema).optional(),
    output_format: z.enum(["mp4", "webm", "mov"]).optional().default("mp4"),
  })
  .refine(data => data.template || (data.operations && data.operations.length > 0), {
    message: "Must provide either template or operations",
  });

export type ValidatedEditContentBody = { accountId: string } & z.infer<typeof editBodySchema>;

/**
 * Validate Edit Content Body.
 *
 * @param request - Parameter.
 * @returns - Result.
 */
export async function validateEditContentBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedEditContentBody> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await safeParseJson(request);
  const result = editBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", field: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { accountId: authResult.accountId, ...result.data };
}
