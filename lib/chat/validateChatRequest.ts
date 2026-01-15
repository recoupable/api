import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { validateOverrideAccountId } from "@/lib/accounts/validateOverrideAccountId";
import { getMessages } from "@/lib/messages/getMessages";

export const chatRequestSchema = z
  .object({
    // Chat content
    prompt: z.string().optional(),
    messages: z.array(z.any()).default([]),
    // Core routing / context fields
    roomId: z.string().optional(),
    accountId: z.string().optional(),
    artistId: z.string().optional(),
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
        errors: validationResult.error.issues.map((err) => ({
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

  // Validate API key authentication
  const accountIdOrError = await getApiKeyAccountId(request);
  if (accountIdOrError instanceof NextResponse) {
    return accountIdOrError;
  }

  let accountId = accountIdOrError;

  // Handle accountId override for org API keys
  if (validatedBody.accountId) {
    const overrideResult = await validateOverrideAccountId({
      apiKey: request.headers.get("x-api-key"),
      targetAccountId: validatedBody.accountId,
    });
    if (overrideResult instanceof NextResponse) {
      return overrideResult;
    }
    accountId = overrideResult.accountId;
  }

  // Normalize chat content:
  // - If messages are provided, keep them as-is
  // - If only prompt is provided, convert it into a single user UIMessage
  const hasMessages =
    Array.isArray(validatedBody.messages) && validatedBody.messages.length > 0;
  const hasPrompt =
    typeof validatedBody.prompt === "string" &&
    validatedBody.prompt.trim().length > 0;

  if (!hasMessages && hasPrompt) {
    validatedBody.messages = getMessages(validatedBody.prompt);
  }

  return {
    ...validatedBody,
    accountId,
  } as ChatRequestBody;
}
