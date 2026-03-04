import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import {
  DEFAULT_CONTENT_TEMPLATE,
  isSupportedContentTemplate,
} from "@/lib/content/contentTemplates";

export const createContentBodySchema = z.object({
  artist_slug: z
    .string({ message: "artist_slug is required" })
    .min(1, "artist_slug cannot be empty"),
  template: z
    .string()
    .min(1, "template cannot be empty")
    .default(DEFAULT_CONTENT_TEMPLATE)
    .optional(),
  lipsync: z.boolean().default(false).optional(),
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

export type ValidatedCreateContentBody = {
  accountId: string;
  artistSlug: string;
  template: string;
  lipsync: boolean;
};

/**
 * Validates auth and request body for POST /api/content/create.
 *
 * @param request
 */
export async function validateCreateContentBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateContentBody> {
  const body = await safeParseJson(request);
  const result = createContentBodySchema.safeParse(body);

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

  const authResult = await validateAuthContext(request, {
    accountId: result.data.account_id,
  });

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const template = result.data.template ?? DEFAULT_CONTENT_TEMPLATE;
  if (!isSupportedContentTemplate(template)) {
    return NextResponse.json(
      {
        status: "error",
        error: `Unsupported template: ${template}`,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return {
    accountId: authResult.accountId,
    artistSlug: result.data.artist_slug,
    template,
    lipsync: result.data.lipsync ?? false,
  };
}
