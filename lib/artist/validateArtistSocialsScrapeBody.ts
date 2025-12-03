import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const artistSocialsScrapeBodySchema = z.object({
  artist_account_id: z.string().min(1, "artist_account_id body parameter is required"),
});

export type ArtistSocialsScrapeBody = z.infer<typeof artistSocialsScrapeBodySchema>;

/**
 * Validates artist socials scrape request body.
 *
 * @param body - The request body to validate.
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateArtistSocialsScrapeBody(
  body: unknown,
): NextResponse | ArtistSocialsScrapeBody {
  const validationResult = artistSocialsScrapeBodySchema.safeParse(body);

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
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

  return validationResult.data;
}

