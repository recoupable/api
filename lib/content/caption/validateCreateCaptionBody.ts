import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { TEMPLATE_IDS } from "@/lib/content/templates";
import { CAPTION_LENGTHS } from "@/lib/content/captionLengths";

export const createTextBodySchema = z.object({
  template: z.enum(TEMPLATE_IDS).optional(),
  topic: z.string().min(1),
  length: z.enum(CAPTION_LENGTHS).optional().default("short"),
});

export type ValidatedCreateCaptionBody = { accountId: string } & z.infer<
  typeof createTextBodySchema
>;

/**
 * Validate Create Caption Body.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
 */
export async function validateCreateCaptionBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateCaptionBody> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await safeParseJson(request);
  const result = createTextBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", field: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { accountId: authResult.accountId, ...result.data };
}
