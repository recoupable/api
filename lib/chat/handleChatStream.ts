import { NextRequest, NextResponse } from "next/server";
import { validateChatRequest } from "./validateChatRequest";
import { streamChatResponse } from "./streamChatResponse";

/**
 * Handles a streaming chat request.
 *
 * This function:
 * 1. Validates the request (auth, body schema)
 * 2. Delegates to streamChatResponse for the actual streaming
 *
 * @param request - The incoming NextRequest
 * @returns A streaming response or error NextResponse
 */
export async function handleChatStream(request: NextRequest): Promise<Response> {
  const validatedBodyOrError = await validateChatRequest(request);
  if (validatedBodyOrError instanceof NextResponse) {
    return validatedBodyOrError;
  }

  return streamChatResponse(validatedBodyOrError, "/api/chat");
}
