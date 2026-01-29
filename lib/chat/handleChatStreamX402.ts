import { NextRequest, NextResponse } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { handleChatCompletion } from "./handleChatCompletion";
import { validateChatRequestX402 } from "./validateChatRequestX402";
import { setupChatRequest } from "./setupChatRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import generateUUID from "@/lib/uuid/generateUUID";

/**
 * Handles a streaming chat request for the x402-protected endpoint.
 *
 * This function:
 * 1. Validates the request (body schema only - auth is handled by x402 payment)
 * 2. Sets up the chat configuration (agent, model, tools)
 * 3. Creates a streaming response using the AI SDK
 *
 * The accountId is passed in the request body and trusted because the caller
 * has already paid via x402 payment verification.
 *
 * @param request - The incoming NextRequest
 * @returns A streaming response or error NextResponse
 */
export async function handleChatStreamX402(request: NextRequest): Promise<Response> {
  const validatedBodyOrError = await validateChatRequestX402(request);
  if (validatedBodyOrError instanceof NextResponse) {
    return validatedBodyOrError;
  }
  const body = validatedBodyOrError;

  try {
    const chatConfig = await setupChatRequest(body);
    const { agent } = chatConfig;

    const stream = createUIMessageStream({
      originalMessages: body.messages,
      generateId: generateUUID,
      execute: async options => {
        const { writer } = options;
        const result = await agent.stream(chatConfig);
        writer.merge(result.toUIMessageStream());
      },
      onFinish: async event => {
        if (event.isAborted) {
          return;
        }
        const assistantMessages = event.messages.filter(message => message.role === "assistant");
        const responseMessages =
          assistantMessages.length > 0 ? assistantMessages : [event.responseMessage];
        await handleChatCompletion(body, responseMessages);
      },
      onError: e => {
        console.error("/api/x402/chat onError:", e);
        return JSON.stringify({
          status: "error",
          message: e instanceof Error ? e.message : "Unknown error",
        });
      },
    });

    return createUIMessageStreamResponse({ stream, headers: getCorsHeaders() });
  } catch (e) {
    console.error("/api/x402/chat Global error:", e);
    return NextResponse.json(
      {
        status: "error",
        message: e instanceof Error ? e.message : "Unknown error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
