import { NextRequest, NextResponse } from "next/server";
import { generateText, type UIMessage } from "ai";
import { validateChatRequest } from "./validateChatRequest";
import { setupChatRequest } from "./setupChatRequest";
import { handleChatCompletion } from "./handleChatCompletion";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import generateUUID from "@/lib/uuid/generateUUID";

/**
 * Handles a non-streaming chat generate request.
 *
 * This function:
 * 1. Validates the request (auth, body schema)
 * 2. Sets up the chat configuration (agent, model, tools)
 * 3. Generates text using the AI SDK's generateText
 * 4. Returns a JSON response with text, reasoning, sources, etc.
 *
 * @param request - The incoming NextRequest
 * @returns A JSON response or error NextResponse
 */
export async function handleChatGenerate(request: NextRequest): Promise<Response> {
  const validatedBodyOrError = await validateChatRequest(request);
  if (validatedBodyOrError instanceof NextResponse) {
    return validatedBodyOrError;
  }
  const body = validatedBodyOrError;

  try {
    const chatConfig = await setupChatRequest(body);

    const result = await generateText(chatConfig);

    // Construct UIMessage from generateText result for handleChatCompletion
    const assistantMessage: UIMessage = {
      id: generateUUID(),
      role: "assistant",
      parts: [{ type: "text", text: result.text }],
    };

    // Handle post-completion tasks (room creation, memory storage, notifications)
    // Errors are handled gracefully within handleChatCompletion
    handleChatCompletion(body, [assistantMessage]).catch(() => {
      // Silently catch - handleChatCompletion handles its own error reporting
    });

    return NextResponse.json(
      {
        text: result.text,
        reasoningText: result.reasoningText,
        sources: result.sources,
        finishReason: result.finishReason,
        usage: result.usage,
        response: {
          messages: result.response.messages,
          headers: result.response.headers,
          body: result.response.body,
        },
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (e) {
    console.error("/api/chat/generate Global error:", e);
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
