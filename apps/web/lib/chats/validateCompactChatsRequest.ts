import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { z } from "zod";

const compactChatsBodySchema = z.object({
  chatId: z
    .array(z.string().uuid("Each chatId must be a valid UUID"))
    .min(1, "chatId array must contain at least one ID"),
  prompt: z.string().optional(),
});

export interface CompactChatsRequestData {
  chatIds: string[];
  prompt?: string;
  accountId: string;
  orgId?: string;
}

/**
 * Validates POST /api/chats/compact request.
 * Handles JSON parsing, body validation, and authentication.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated request data
 */
export async function validateCompactChatsRequest(
  request: NextRequest,
): Promise<NextResponse | CompactChatsRequestData> {
  // Parse request body
  const body = await safeParseJson(request);

  // Validate body schema
  const bodyResult = compactChatsBodySchema.safeParse(body);
  if (!bodyResult.success) {
    const firstError = bodyResult.error.issues[0];
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

  const { chatId: chatIds, prompt } = bodyResult.data;

  // Authenticate the request
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId, orgId } = authResult;

  return {
    chatIds,
    prompt,
    accountId,
    orgId,
  };
}
