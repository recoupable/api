import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { validateChatRequest } from "./validateChatRequest";
import { setupChatRequest } from "./setupChatRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

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

    // Note: Credit handling and chat completion handling will be added
    // as part of the handleChatCredits and handleChatCompletion migrations

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
