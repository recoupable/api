import type { NextRequest } from "next/server";
import { codingAgentBot } from "@/lib/coding-agent/bot";
import { handleCodingAgentCallback } from "@/lib/coding-agent/handleCodingAgentCallback";

/**
 * Handles POST requests.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
 */
export async function POST(request: NextRequest) {
  await codingAgentBot.initialize();
  return handleCodingAgentCallback(request);
}
