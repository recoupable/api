import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const addArtistToOrgBodySchema = z.object({
  artistId: z.string().uuid("artistId must be a valid UUID"),
  organizationId: z.string().uuid("organizationId must be a valid UUID"),
});

export type AddArtistToOrgBody = z.infer<typeof addArtistToOrgBodySchema>;

/**
 * Validates request body for POST /api/organizations/artists.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateAddArtistToOrgBody(body: unknown): NextResponse | AddArtistToOrgBody {
  const result = addArtistToOrgBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
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

