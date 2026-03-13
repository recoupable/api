import { NextRequest, NextResponse } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { handleChatCompletion } from "./handleChatCompletion";
import { validateChatRequest } from "./validateChatRequest";
import { setupChatRequest } from "./setupChatRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import generateUUID from "@/lib/uuid/generateUUID";

/**
 * Handles a streaming chat request.
 *
 * This function:
 * 1. Validates the request (auth, body schema)
 * 2. Sets up the chat configuration (agent, model, tools)
 * 3. Creates a streaming response using the AI SDK
 *
 * @param request - The incoming NextRequest
 * @returns A streaming response or error NextResponse
 */
export async function handleChatStream(request: NextRequest): Promise<Response> {
  const validatedBodyOrError = await validateChatRequest(request);
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
        // Note: Credit handling and chat completion handling will be added
        // as part of the handleChatCredits and handleChatCompletion migrations
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
        console.error("/api/chat onError:", e);
        return JSON.stringify({
          status: "error",
          message: e instanceof Error ? e.message : "Unknown error",
        });
      },
    });

    return createUIMessageStreamResponse({ stream, headers: getCorsHeaders() });
  } catch (e) {
    console.error("/api/chat Global error:", e);
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
