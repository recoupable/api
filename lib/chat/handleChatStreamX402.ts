import { NextRequest, NextResponse } from "next/server";
import { validateChatRequestX402 } from "./validateChatRequestX402";
import { streamChatResponse } from "./streamChatResponse";

/**
 * Handles a streaming chat request for the x402-protected endpoint.
 *
 * This function:
 * 1. Validates the request (body schema only - auth is handled by x402 payment)
 * 2. Delegates to streamChatResponse for the actual streaming
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

  return streamChatResponse(validatedBodyOrError, "/api/x402/chat");
}
