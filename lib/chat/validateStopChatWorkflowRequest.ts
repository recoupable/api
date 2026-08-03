import { NextRequest, NextResponse } from "next/server";
import {
  validateChatOwnership,
  type ValidatedChatOwnership,
} from "@/lib/chat/validateChatOwnership";

export type ValidatedStopChatWorkflowRequest = ValidatedChatOwnership;

/**
 * Validates POST /api/chat/{chatId}/stop: auth, chatId format, and chat +
 * session-ownership lookup.
 *
 * Thin alias over `validateChatOwnership`, which `GET
 * /api/chat/{chatId}/stream` shares — both routes must agree on who may
 * touch a chat, so the rule lives in one place.
 *
 * @param request - The incoming request.
 * @param chatId - Chat id from the route params.
 * @returns The auth context + chat row, or an error response.
 */
export async function validateStopChatWorkflowRequest(
  request: NextRequest,
  chatId: string,
): Promise<NextResponse | ValidatedStopChatWorkflowRequest> {
  return validateChatOwnership(request, chatId);
}
