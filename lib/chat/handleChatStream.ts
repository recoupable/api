import { NextRequest, NextResponse } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { handleChatCompletion } from "./handleChatCompletion";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";
import { validateChatRequest } from "./validateChatRequest";
import { setupChatRequest } from "./setupChatRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import generateUUID from "@/lib/uuid/generateUUID";
import { DEFAULT_MODEL } from "@/lib/const";
import type { ChatRequestBody } from "./validateChatRequest";
import type { UIMessage } from "ai";

type ChatStreamFinishHandler = (params: {
  body: ChatRequestBody;
  responseMessages: UIMessage[];
  writer: {
    write: (chunk: unknown) => void;
  };
}) => Promise<void>;

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
export async function handleChatStream(
  request: NextRequest,
  onFinish?: ChatStreamFinishHandler,
): Promise<Response> {
  const validatedBodyOrError = await validateChatRequest(request);
  if (validatedBodyOrError instanceof NextResponse) {
    return validatedBodyOrError;
  }
  const body = validatedBodyOrError;

  try {
    const chatConfig = await setupChatRequest(body);
    const { agent } = chatConfig;

    let streamResult: Awaited<ReturnType<typeof agent.stream>> | undefined;

    const stream = createUIMessageStream({
      originalMessages: body.messages,
      generateId: generateUUID,
      execute: async options => {
        const { writer } = options;
        streamResult = await agent.stream(chatConfig);
        writer.merge(
          streamResult.toUIMessageStream({
            sendFinish: false,
            onFinish: async event => {
              if (event.isAborted) {
                return;
              }

              const assistantMessages = event.messages.filter(
                message => message.role === "assistant",
              );
              const responseMessages =
                assistantMessages.length > 0 ? assistantMessages : [event.responseMessage];
              await handleChatCompletion(body, responseMessages);
              await onFinish?.({ body, responseMessages, writer });

              writer.write({
                type: "finish",
                finishReason: event.finishReason,
              });

              await handleChatCredits({
                usage: await streamResult!.usage,
                model: body.model ?? DEFAULT_MODEL,
                accountId: body.accountId,
              });
            },
          }),
        );
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
