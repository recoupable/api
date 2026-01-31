import { fetchWithPaymentStream } from "../fetchWithPaymentStream";
import type { ChatRequestBody } from "@/lib/chat/validateChatRequest";

/**
 * Request body for the x402 chat endpoint.
 * Similar to ChatRequestBody but with accountId required.
 */
export interface X402ChatRequestBody {
  messages: unknown[];
  prompt?: string;
  roomId?: string;
  accountId: string;
  artistId?: string;
  organizationId?: string;
  model?: string;
  excludeTools?: string[];
}

/**
 * Calls the x402-protected chat endpoint with payment.
 *
 * This function:
 * 1. Deducts credits from the account
 * 2. Makes the x402 payment (USDC transfer)
 * 3. Forwards the request to the x402 chat endpoint
 * 4. Returns the streaming response
 *
 * @param body - The validated chat request body.
 * @param baseUrl - The base URL for the API.
 * @returns Promise resolving to the streaming Response.
 */
export async function x402Chat(body: ChatRequestBody, baseUrl: string): Promise<Response> {
  const x402Url = new URL("/api/x402/chat", baseUrl);

  // Build the request body for the x402 endpoint
  const x402Body: X402ChatRequestBody = {
    messages: body.messages,
    accountId: body.accountId,
  };

  if (body.prompt) {
    x402Body.prompt = body.prompt;
  }
  if (body.roomId) {
    x402Body.roomId = body.roomId;
  }
  if (body.artistId) {
    x402Body.artistId = body.artistId;
  }
  if (body.orgId) {
    x402Body.organizationId = body.orgId;
  }
  if (body.model) {
    x402Body.model = body.model;
  }
  if (body.excludeTools) {
    x402Body.excludeTools = body.excludeTools;
  }

  return fetchWithPaymentStream(x402Url.toString(), body.accountId, x402Body);
}
