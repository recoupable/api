import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const launchBodySchema = z.object({
  artist_name: z
    .string({ message: "artist_name is required" })
    .min(1, "artist_name cannot be empty"),
  song_name: z.string({ message: "song_name is required" }).min(1, "song_name cannot be empty"),
  genre: z.string({ message: "genre is required" }).min(1, "genre cannot be empty"),
  release_date: z
    .string({ message: "release_date is required" })
    .min(1, "release_date cannot be empty"),
  description: z.string().optional(),
});

export type LaunchBody = z.infer<typeof launchBodySchema>;

/**
 * Validates request body for POST /api/launch.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateLaunchBody(body: unknown): NextResponse | LaunchBody {
  const result = launchBodySchema.safeParse(body);

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
