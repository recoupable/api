import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const socialScrapeBodySchema = z.object({
  social_id: z.string().min(1, "social_id body parameter is required"),
});

export type SocialScrapeBody = z.infer<typeof socialScrapeBodySchema>;

/**
 * Validates social scrape request body.
 *
 * @param body - The request body to validate.
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateSocialScrapeBody(body: unknown): NextResponse | SocialScrapeBody {
  const validationResult = socialScrapeBodySchema.safeParse(body);

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
