import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateChatAccess } from "@/lib/chats/validateChatAccess";

export const copyChatMessagesBodySchema = z.object({
  targetChatId: z.string().uuid("targetChatId must be a valid UUID"),
  clearExisting: z.boolean().optional().default(true),
});

export type CopyChatMessagesBody = z.infer<typeof copyChatMessagesBodySchema>;

export interface ValidatedCopyChatMessages {
  sourceChatId: string;
  targetChatId: string;
  clearExisting: boolean;
}

/**
 * Validates POST /api/chats/[id]/messages/copy request.
 * Ensures body shape and that caller can access both source and target chats.
 *
 * @param request - Incoming request with auth context and JSON body.
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

  const { targetChatId, clearExisting } = bodyResult.data;

  if (sourceChatId === targetChatId) {
    return NextResponse.json(
      { status: "error", error: "source and target chats must be different" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const sourceAccess = await validateChatAccess(request, sourceChatId);
  if (sourceAccess instanceof NextResponse) {
    return sourceAccess;
  }

  const targetAccess = await validateChatAccess(request, targetChatId);
  if (targetAccess instanceof NextResponse) {
    return targetAccess;
  }

  return {
    sourceChatId: sourceAccess.roomId,
    targetChatId: targetAccess.roomId,
    clearExisting,
  };
}
