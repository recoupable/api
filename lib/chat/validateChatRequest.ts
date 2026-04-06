import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getMessages } from "@/lib/messages/getMessages";
import convertToUiMessages from "@/lib/messages/convertToUiMessages";
import { setupConversation } from "@/lib/chat/setupConversation";
import { validateMessages } from "@/lib/chat/validateMessages";

export const chatRequestSchema = z
  .object({
    // Chat content
    prompt: z.string().optional(),
    messages: z.array(z.any()).default([]),
    // Core routing / context fields
    roomId: z.string().optional(),
    topic: z.string().optional(),
    accountId: z.string().optional(),
    artistId: z.string().optional(),
    organizationId: z.string().optional(),
    model: z.string().optional(),
    excludeTools: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    const hasMessages = Array.isArray(data.messages) && data.messages.length > 0;
    const hasPrompt = typeof data.prompt === "string" && data.prompt.trim().length > 0;

    if ((hasMessages && hasPrompt) || (!hasMessages && !hasPrompt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one of messages or prompt must be provided",
        path: ["messages"],
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one of messages or prompt must be provided",
        path: ["prompt"],
      });
    }
  });

type BaseChatRequestBody = z.infer<typeof chatRequestSchema>;

export type ChatRequestBody = BaseChatRequestBody & {
  accountId: string;
  orgId: string | null;
  authToken?: string;
};

/**
 * Validates chat request body and auth headers.
 *
 * Returns:
 * - NextResponse (400/401/403/500) when invalid (body or headers)
 * - Parsed & augmented body when valid (including header-derived accountId)
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error or validated ChatRequestBody
 */
export async function validateChatRequest(
  request: NextRequest,
): Promise<NextResponse | ChatRequestBody> {
  const json = await request.json();
  const validationResult = chatRequestSchema.safeParse(json);

  if (!validationResult.success) {
    return NextResponse.json(
      {
        status: "error",
        message: "Invalid input",
        errors: validationResult.error.issues.map(err => ({
          field: err.path.join("."),
          message: err.message,
        })),
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const validatedBody: BaseChatRequestBody = validationResult.data;

  // Authenticate, handle accountId/organizationId overrides
  const authResult = await validateAuthContext(request, {
    accountId: validatedBody.accountId,
    organizationId: validatedBody.organizationId,
  });
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { accountId, orgId } = authResult;

  // Normalize chat content:
  // - If only prompt is provided, convert it into a single user UIMessage
  // - Convert all messages to UIMessage format (handles mixed formats)
  const hasMessages = Array.isArray(validatedBody.messages) && validatedBody.messages.length > 0;
  const hasPrompt =
    typeof validatedBody.prompt === "string" && validatedBody.prompt.trim().length > 0;

  if (!hasMessages && hasPrompt) {
    validatedBody.messages = getMessages(validatedBody.prompt);
  }

  // Convert messages to UIMessage format and get the last (newest) message
  const uiMessages = convertToUiMessages(validatedBody.messages);
  const { lastMessage } = validateMessages(uiMessages);

  // Setup conversation: auto-create room if needed and persist user message
  // Use the message's original ID to prevent duplicates with handleChatCompletion's upsert
  const { roomId: finalRoomId } = await setupConversation({
    accountId,
    roomId: validatedBody.roomId,
    topic: validatedBody.topic,
    promptMessage: lastMessage,
    artistId: validatedBody.artistId,
    memoryId: lastMessage.id,
  });

  return {
    ...validatedBody,
    accountId,
    orgId,
    roomId: finalRoomId,
    authToken: authResult.authToken,
  } as ChatRequestBody;
}
