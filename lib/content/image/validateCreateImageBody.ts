import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

const imageParamsSchema = z.strictObject({
  prompt: z.string().min(1).optional(),
  image_urls: z.array(z.string().url()).min(1).max(10).optional(),
  num_images: z.number().int().min(1).max(4).optional().default(1),
  aspect_ratio: z
    .enum(["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"])
    .optional(),
  output_format: z.enum(["jpeg", "png", "webp"]).optional().default("webp"),
  sync_mode: z.boolean().optional().default(false),
});

// The existing hosted worker used these two aliases. Preserve their editing
// intent during rollout, but emit only the current Muse Image contract.
export const createImageBodySchema = imageParamsSchema
  .extend({
    reference_image_url: z.string().url().optional(),
    images: z.array(z.string().url()).optional(),
  })
  .transform(({ reference_image_url, images, ...current }): z.input<typeof imageParamsSchema> => {
    const references = [
      ...new Set([
        ...(current.image_urls ?? []),
        ...(reference_image_url ? [reference_image_url] : []),
        ...(images ?? []),
      ]),
    ];
    return { ...current, ...(references.length > 0 && { image_urls: references }) };
  })
  .pipe(imageParamsSchema);

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
