import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { buildGetChatsParams } from "./buildGetChatsParams";
import { z } from "zod";

/**
 * Zod schema for PATCH /api/chats request body.
 */
export const updateChatBodySchema = z.object({
  chatId: z.string().uuid("chatId must be a valid UUID"),
  topic: z
    .string({ message: "topic is required" })
    .min(3, "topic must be between 3 and 50 characters")
    .max(50, "topic must be between 3 and 50 characters"),
});

export type UpdateChatBody = z.infer<typeof updateChatBodySchema>;

/**
 * Validated update chat request data.
 */
export interface ValidatedUpdateChat {
  chatId: string;
  topic: string;
}

/**
 * Validates request for PATCH /api/chats.
 * Parses JSON, validates schema, authenticates, verifies room exists, and checks access.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated data if validation passes.
 */
export async function validateUpdateChatBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedUpdateChat> {
  // Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // Validate body schema
  const result = updateChatBodySchema.safeParse(body);
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

  const { chatId, topic } = result.data;

  // Validate authentication
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId, orgId } = authResult;

  // Verify room exists
  const room = await selectRoom(chatId);
  if (!room) {
    return NextResponse.json(
      { status: "error", error: "Chat room not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  // Check access control
  const { params } = await buildGetChatsParams({
    account_id: accountId,
    org_id: orgId,
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

  return {
    chatId,
    topic,
  };
}
