import { NextResponse } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { handleChatCompletion } from "./handleChatCompletion";
import { setupChatRequest } from "./setupChatRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import generateUUID from "@/lib/uuid/generateUUID";
import type { ChatRequestBody } from "./validateChatRequest";

/**
 * Creates a streaming chat response from a validated request body.
 *
 * This is the core streaming logic shared by both:
 * - handleChatStream (for /api/chat with auth validation)
 * - handleChatStreamX402 (for /api/x402/chat with x402 payment validation)
 *
 * @param body - The validated chat request body with accountId resolved.
 * @param logPrefix - Optional prefix for error logs (default: "/api/chat").
 * @returns A streaming response or error NextResponse.
 */
export async function streamChatResponse(
  body: ChatRequestBody,
  logPrefix: string = "/api/chat",
): Promise<Response> {
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
        console.error(`${logPrefix} onError:`, e);
        return JSON.stringify({
          status: "error",
          message: e instanceof Error ? e.message : "Unknown error",
        });
      },
    });

    // Add Content-Encoding: none to prevent proxy middleware from buffering the stream
    // See: https://ai-sdk.dev/docs/troubleshooting/streaming-not-working-when-proxied
    return createUIMessageStreamResponse({
      stream,
      headers: {
        ...getCorsHeaders(),
        "Content-Encoding": "none",
      },
    });
  } catch (e) {
    console.error(`${logPrefix} Global error:`, e);
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
