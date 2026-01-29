import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getMessages } from "@/lib/messages/getMessages";
import convertToUiMessages from "@/lib/messages/convertToUiMessages";
import { setupConversation } from "@/lib/chat/setupConversation";
import { validateMessages } from "@/lib/chat/validateMessages";
import type { ChatRequestBody } from "./validateChatRequest";

/**
 * Schema for x402-protected chat requests.
 * Unlike the regular chat endpoint, accountId is required in the body
 * since auth is handled by x402 payment verification.
 */
export const chatRequestX402Schema = z
  .object({
    // Chat content
    prompt: z.string().optional(),
    messages: z.array(z.any()).default([]),
    // Core routing / context fields
    roomId: z.string().optional(),
    accountId: z.string({ message: "accountId is required" }),
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

type BaseChatRequestX402Body = z.infer<typeof chatRequestX402Schema>;

/**
 * Validates chat request body for x402-protected endpoint.
 *
 * Unlike the regular validateChatRequest, this function:
 * - Does NOT validate authentication headers (x402 payment is the auth)
 * - Requires accountId in the request body
 * - Trusts the accountId because the caller has paid via x402
 *
 * Returns:
 * - NextResponse (400) when body is invalid
 * - Parsed & augmented body when valid
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error or validated ChatRequestBody
 */
export async function validateChatRequestX402(
  request: NextRequest,
): Promise<NextResponse | ChatRequestBody> {
  const json = await request.json();
  const validationResult = chatRequestX402Schema.safeParse(json);

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

  const validatedBody: BaseChatRequestX402Body = validationResult.data;

  // accountId is trusted because x402 payment was verified
  const accountId = validatedBody.accountId;

  // organizationId can be passed but we don't validate access since x402 payment is the auth
  const orgId = validatedBody.organizationId ?? null;

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
  const { roomId: finalRoomId } = await setupConversation({
    accountId,
    roomId: validatedBody.roomId,
    promptMessage: lastMessage,
    artistId: validatedBody.artistId,
    memoryId: lastMessage.id,
  });

  return {
    ...validatedBody,
    accountId,
    orgId,
    roomId: finalRoomId,
    // No authToken for x402 - payment is the auth
    authToken: undefined,
  } as ChatRequestBody;
}
