import type { NextRequest } from "next/server";
import { codingAgentBot } from "@/lib/coding-agent/bot";
import { handleCodingAgentCallback } from "@/lib/coding-agent/handleCodingAgentCallback";

/**
 * POST.
 *
 * @param request - Parameter.
 * @returns - Result.
 */
export async function POST(request: NextRequest) {
  await codingAgentBot.initialize();
  return handleCodingAgentCallback(request);
}
