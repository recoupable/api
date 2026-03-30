import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { buildGetChatsParams } from "./buildGetChatsParams";

export const deleteChatBodySchema = z.object({
  chatId: z.string().uuid("chatId must be a valid UUID"),
});

export type DeleteChatBody = z.infer<typeof deleteChatBodySchema>;

export interface ValidatedDeleteChat {
  chatId: string;
}

/**
 * Validates request for DELETE /api/chats.
 * Parses JSON, validates schema, authenticates, verifies room exists, and checks access.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or validated data if it passes
 */
export async function validateDeleteChatBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedDeleteChat> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = deleteChatBodySchema.safeParse(body);
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

  const { chatId } = result.data;

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId } = authResult;

  const room = await selectRoom(chatId);
  if (!room) {
    return NextResponse.json(
      { status: "error", error: "Chat room not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const { params } = await buildGetChatsParams({
    account_id: accountId,
  });

  // If params.account_ids is undefined, it means admin access (all records)
  if (params.account_ids && room.account_id) {
    if (!params.account_ids.includes(room.account_id)) {
      return NextResponse.json(
        { status: "error", error: "Access denied to this chat" },
        { status: 403, headers: getCorsHeaders() },
      );
    }
  }

  return { chatId };
}
