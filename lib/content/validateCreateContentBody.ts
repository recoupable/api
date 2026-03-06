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
import { resolveArtistSlug } from "@/lib/content/resolveArtistSlug";

export const CAPTION_LENGTHS = ["short", "medium", "long"] as const;

export const createContentBodySchema = z.object({
  artist_slug: z.string().min(1, "artist_slug cannot be empty").optional(),
  artist_account_id: z.string().uuid("artist_account_id must be a valid UUID").optional(),
  template: z
    .string()
    .min(1, "template cannot be empty")
    .optional()
    .default(DEFAULT_CONTENT_TEMPLATE),
  lipsync: z.boolean().optional().default(false),
  caption_length: z.enum(CAPTION_LENGTHS).optional().default("short"),
  upscale: z.boolean().optional().default(false),
  batch: z.number().int().min(1).max(30).optional().default(1),
});

export type ValidatedCreateContentBody = {
  accountId: string;
  artistSlug: string;
  template: string;
  lipsync: boolean;
  captionLength: "short" | "medium" | "long";
  upscale: boolean;
  batch: number;
};

/**
 * Validates auth and request body for POST /api/content/create.
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
        field: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const authResult = await validateAuthContext(request);

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

  // Resolve artist slug from either artist_slug or artist_account_id
  let artistSlug = result.data.artist_slug;
  if (!artistSlug && result.data.artist_account_id) {
    artistSlug = await resolveArtistSlug(result.data.artist_account_id) ?? undefined;
    if (!artistSlug) {
      return NextResponse.json(
        { status: "error", error: "Artist not found for the provided artist_account_id" },
        { status: 404, headers: getCorsHeaders() },
      );
    }
  }
  if (!artistSlug) {
    return NextResponse.json(
      { status: "error", error: "Either artist_slug or artist_account_id is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return {
    accountId: authResult.accountId,
    artistSlug,
    template,
    lipsync: result.data.lipsync ?? false,
    captionLength: result.data.caption_length ?? "short",
    upscale: result.data.upscale ?? false,
    batch: result.data.batch ?? 1,
  };
}

