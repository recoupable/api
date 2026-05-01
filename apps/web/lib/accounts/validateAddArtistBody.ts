import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const addArtistBodySchema = z.object({
  email: z.string().email("email must be a valid email address"),
  artistId: z.string().uuid("artistId must be a valid UUID"),
});

export type AddArtistBody = z.infer<typeof addArtistBodySchema>;

/**
 * Validates request body for POST /api/accounts/artists.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateAddArtistBody(body: unknown): NextResponse | AddArtistBody {
  const result = addArtistBodySchema.safeParse(body);

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
