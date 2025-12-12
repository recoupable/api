import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const artistsQuerySchema = z.object({
  accountId: z.string({ message: "accountId is required" }).uuid("accountId must be a valid UUID"),
  orgId: z.string().uuid("orgId must be a valid UUID").optional(),
  personal: z.enum(["true", "false"], { message: "personal must be 'true' or 'false'" }).optional(),
});

export type ArtistsQuery = z.infer<typeof artistsQuerySchema>;

/**
 * Validates query parameters for GET /api/artists.
 *
 * @param searchParams - The URL search parameters
 * @returns A NextResponse with an error if validation fails, or the validated query if validation passes.
 */
export function validateArtistsQuery(searchParams: URLSearchParams): NextResponse | ArtistsQuery {
  const params = Object.fromEntries(searchParams.entries());
  const result = artistsQuerySchema.safeParse(params);

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

