import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { validateOverrideAccountId } from "@/lib/accounts/validateOverrideAccountId";
import { getMessages } from "@/lib/messages/getMessages";
import convertToUiMessages from "@/lib/messages/convertToUiMessages";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
import { setupConversation } from "@/lib/chat/setupConversation";
import { validateMessages } from "@/lib/chat/validateMessages";

export const chatRequestSchema = z
  .object({
    // Chat content
    prompt: z.string().optional(),
    messages: z.array(z.any()).default([]),
    // Core routing / context fields
    roomId: z.string().optional(),
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

  // Check which auth mechanism is provided
  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  const hasApiKey = !!apiKey;
  const hasAuth = !!authHeader;

  // Enforce that exactly one auth mechanism is provided
  if ((hasApiKey && hasAuth) || (!hasApiKey && !hasAuth)) {
    return NextResponse.json(
      {
        status: "error",
        message: "Exactly one of x-api-key or Authorization must be provided",
      },
      {
        status: 401,
        headers: getCorsHeaders(),
      },
    );
  }

  // Authenticate and get accountId and orgId
  let accountId: string;
  let orgId: string | null = null;

  if (hasApiKey) {
    // Validate API key authentication
    const accountIdOrError = await getApiKeyAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }
    accountId = accountIdOrError;

    // Get org context from API key details
    const keyDetails = await getApiKeyDetails(apiKey!);
    if (keyDetails) {
      orgId = keyDetails.orgId;
    }

    // Handle accountId override for org API keys
    if (validatedBody.accountId) {
      const overrideResult = await validateOverrideAccountId({
        apiKey,
        targetAccountId: validatedBody.accountId,
      });
      if (overrideResult instanceof NextResponse) {
        return overrideResult;
      }
      accountId = overrideResult.accountId;
    }
  } else {
    // Validate bearer token authentication (no org context for JWT auth)
    const accountIdOrError = await getAuthenticatedAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }
    accountId = accountIdOrError;
  }

  // Handle organizationId override from request body
  if (validatedBody.organizationId) {
    const hasOrgAccess = await validateOrganizationAccess({
      accountId,
      organizationId: validatedBody.organizationId,
    });

    if (!hasOrgAccess) {
      return NextResponse.json(
        {
          status: "error",
          message: "Access denied to specified organizationId",
        },
        {
          status: 403,
          headers: getCorsHeaders(),
        },
      );
    }

    // Use the provided organizationId as orgId
    orgId = validatedBody.organizationId;
  }

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
    promptMessage: lastMessage,
    artistId: validatedBody.artistId,
    memoryId: lastMessage.id,
  });

  return {
    ...validatedBody,
    accountId,
    orgId,
    roomId: finalRoomId,
  } as ChatRequestBody;
}
