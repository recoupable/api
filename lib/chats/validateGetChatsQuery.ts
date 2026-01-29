import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

const getChatsQuerySchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID"),
  artist_account_id: z.string().uuid("artist_account_id must be a valid UUID").optional(),
});

export type GetChatsQuery = z.infer<typeof getChatsQuerySchema>;

/**
 * Validates query parameters for GET /api/chats.
 *
 * @param searchParams - The URL search params
 * @returns A NextResponse with an error if validation fails, or the validated query if validation passes.
 */
export function validateGetChatsQuery(searchParams: URLSearchParams): NextResponse | GetChatsQuery {
  const params = {
    account_id: searchParams.get("account_id") || undefined,
    artist_account_id: searchParams.get("artist_account_id") || undefined,
  };

  const result = getChatsQuerySchema.safeParse(params);

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
