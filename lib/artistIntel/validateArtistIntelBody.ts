import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const artistIntelBodySchema = z.object({
  artist_name: z
    .string({ message: "artist_name is required" })
    .min(1, "artist_name cannot be empty"),
});

export type ArtistIntelBody = z.infer<typeof artistIntelBodySchema>;

/**
 * Validates the request body for POST /api/artists/intel.
 *
 * @param body - The raw request body (parsed JSON).
 * @returns A NextResponse with an error if validation fails, or the validated body if it passes.
 */
export function validateArtistIntelBody(body: unknown): NextResponse | ArtistIntelBody {
  const result = artistIntelBodySchema.safeParse(body);

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
