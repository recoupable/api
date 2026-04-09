import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { TEMPLATE_IDS } from "@/lib/content/templates";

export const createImageBodySchema = z.object({
  template: z.enum(TEMPLATE_IDS).optional(),
  prompt: z.string().optional(),
  reference_image_url: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  num_images: z.number().int().min(1).max(4).optional().default(1),
  aspect_ratio: z
    .enum([
      "auto",
      "21:9",
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
      "4:1",
      "1:4",
      "8:1",
      "1:8",
    ])
    .optional()
    .default("auto"),
  resolution: z.enum(["0.5K", "1K", "2K", "4K"]).optional().default("1K"),
  model: z.string().optional(),
});

export type ValidatedCreateImageBody = { accountId: string } & z.infer<
  typeof createImageBodySchema
>;

/**
 * Validates auth and request body for POST /api/content/image.
 */
export async function validateCreateImageBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateImageBody> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await safeParseJson(request);
  const result = createImageBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", field: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { accountId: authResult.accountId, ...result.data };
}
