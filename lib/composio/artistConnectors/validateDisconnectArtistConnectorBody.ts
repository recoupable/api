import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const disconnectArtistConnectorBodySchema = z.object({
  artist_id: z.string().uuid("artist_id must be a valid UUID"),
  connected_account_id: z.string().min(1, "connected_account_id is required"),
});

export type DisconnectArtistConnectorBody = z.infer<typeof disconnectArtistConnectorBodySchema>;

/**
 * Validates request body for DELETE /api/artist-connectors.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateDisconnectArtistConnectorBody(
  body: unknown,
): NextResponse | DisconnectArtistConnectorBody {
  const result = disconnectArtistConnectorBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
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
