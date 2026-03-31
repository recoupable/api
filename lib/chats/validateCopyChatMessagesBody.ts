import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const copyChatMessagesBodySchema = z.object({
  targetChatId: z.string().uuid("targetChatId must be a valid UUID"),
});

export type CopyChatMessagesBody = z.infer<typeof copyChatMessagesBodySchema>;

export interface ValidatedCopyChatMessages {
  targetChatId: string;
}

/**
 * Validates POST /api/chats/[id]/messages/copy request.
 * Ensures body shape and basic source/target constraints.
 *
 * @param request - Incoming request with JSON body.
 * @param sourceChatId - Source chat ID from route params.
 * @returns Validation error response or validated payload.
 */
export async function validateCopyChatMessagesBody(
  request: NextRequest,
  sourceChatId: string,
): Promise<NextResponse | ValidatedCopyChatMessages> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const bodyResult = copyChatMessagesBodySchema.safeParse(body);
  if (!bodyResult.success) {
    const firstError = bodyResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const { targetChatId } = bodyResult.data;

  if (sourceChatId === targetChatId) {
    return NextResponse.json(
      { status: "error", error: "source and target chats must be different" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return {
    targetChatId,
  };
}
