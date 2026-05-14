import { NextRequest, NextResponse } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { handleChatCompletion } from "./handleChatCompletion";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL } from "@/lib/credits/const";
import { validateChatRequest } from "./validateChatRequest";
import { setupChatRequest } from "./setupChatRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import generateUUID from "@/lib/uuid/generateUUID";
import { DEFAULT_MODEL } from "@/lib/const";

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

  // Approach A preflight: require at least 1 credit before streaming. Auto-
  // recharges silently if the account is short and has a saved card; otherwise
  // 402s with checkoutUrl (+ declineReason when Stripe rejected the card) so
  // open-agents can route the human to update billing.
  if (body.accountId) {
    const short = await ensureCreditsOrShortCircuit({
      accountId: body.accountId,
      creditsToDeduct: 1,
      successUrl: CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL,
    });
    if (short) return short;
  }

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
        writer.merge(streamResult.toUIMessageStream());
      },
      onFinish: async event => {
        if (event.isAborted) {
          return;
        }
        const assistantMessages = event.messages.filter(message => message.role === "assistant");
        const responseMessages =
          assistantMessages.length > 0 ? assistantMessages : [event.responseMessage];
        await handleChatCompletion(body, responseMessages);
        if (streamResult) {
          await handleChatCredits({
            usage: await streamResult.usage,
            model: body.model ?? DEFAULT_MODEL,
            accountId: body.accountId,
          });
        }
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
