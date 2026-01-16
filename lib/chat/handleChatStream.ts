import { NextRequest, NextResponse } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { validateChatRequest } from "./validateChatRequest";
import { setupChatRequest } from "./setupChatRequest";
import { handleChatCompletion } from "./handleChatCompletion";
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
      execute: async (options) => {
        const { writer } = options;
        const result = await agent.stream(chatConfig);
        writer.merge(result.toUIMessageStream());
      },
      onError: (e) => {
        console.error("/api/chat onError:", e);
        return JSON.stringify({
          status: "error",
          message: e instanceof Error ? e.message : "Unknown error",
        });
      },
      onFinish: ({ messages }) => {
        console.log("🟢 onFinish triggered, messages count:", messages?.length);
        void handleChatCompletion(body, messages).catch((e) => {
          console.error("Failed to handle chat completion:", e);
        });
      },
    });

    return createUIMessageStreamResponse({ stream });
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
