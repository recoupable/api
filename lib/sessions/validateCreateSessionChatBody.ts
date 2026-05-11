import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const createSessionChatBodySchema = z.object({
  id: z.string({ error: "Invalid chat id" }).min(1, "Invalid chat id").optional(),
});

export type CreateSessionChatBody = z.infer<typeof createSessionChatBodySchema>;

/**
 * Validates the body for `POST /api/sessions/{sessionId}/chats`.
 *
 * The endpoint accepts an optional `id` so callers can deterministically
 * "claim" a chat id and idempotently retry. An explicitly empty or
 * non-string id is rejected with the same 400 shape open-agents used
 * (`{ error: "Invalid chat id" }`) for parity.
 *
 * @param body - The parsed request body (may be `null` / non-object).
 * @returns A 400 NextResponse on failure, or the validated body.
 */
export function validateCreateSessionChatBody(body: unknown): NextResponse | CreateSessionChatBody {
  const candidate = body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const result = createSessionChatBodySchema.safeParse(candidate);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid chat id" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
