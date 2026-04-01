import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateChatAccess, type ValidatedChatAccess } from "@/lib/chats/validateChatAccess";

const chatIdSchema = z.string().uuid("id must be a valid UUID");

/**
 * Validates auth and params for GET /api/chats/[id]/messages.
 *
 * @param request - Incoming request used to validate chat access.
 * @param id - Chat identifier from route params.
 * @returns NextResponse on failure, or validated chat access data.
 */
export async function validateGetChatMessagesQuery(
  request: NextRequest,
  id: string,
): Promise<NextResponse | ValidatedChatAccess> {
  const parsedId = chatIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(
      {
        status: "error",
        error: parsedId.error.issues[0]?.message || "Invalid chat ID",
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return validateChatAccess(request, parsedId.data);
}
