import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

const catalogSongInputSchema = z.object({
  catalog_id: z.string().min(1, "catalog_id is required"),
  isrc: z.string().min(1, "isrc is required"),
  name: z.string().optional(),
  album: z.string().optional(),
  notes: z.string().optional(),
  artists: z.array(z.string()).optional(),
});

export const catalogSongsRequestSchema = z.object({
  songs: z.array(catalogSongInputSchema).min(1, "songs array is required and must not be empty"),
});

export type CatalogSongsRequest = z.infer<typeof catalogSongsRequestSchema>;

/**
 * Validates a catalog songs request body.
 *
 * @param body - The request body to validate.
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateCatalogSongsRequest(body: unknown): NextResponse | CatalogSongsRequest {
  const validationResult = catalogSongsRequestSchema.safeParse(body);

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
