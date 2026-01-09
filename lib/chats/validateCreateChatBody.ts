import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const createChatBodySchema = z.object({
  artistId: z.string().uuid("artistId must be a valid UUID").optional(),
  chatId: z.string().uuid("chatId must be a valid UUID").optional(),
});

export type CreateChatBody = z.infer<typeof createChatBodySchema>;

/**
 * Validates request body for POST /api/chats.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateCreateChatBody(body: unknown): NextResponse | CreateChatBody {
  const result = createChatBodySchema.safeParse(body);

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
