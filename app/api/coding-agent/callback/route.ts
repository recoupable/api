import type { NextRequest } from "next/server";
import redis from "@/lib/redis/connection";
import "@/lib/coding-agent/bot";
import { handleCodingAgentCallback } from "@/lib/coding-agent/handleCodingAgentCallback";

/**
 * POST /api/coding-agent/callback
 *
 * Callback endpoint for the coding agent Trigger.dev task.
 * Receives task results and posts them back to the Slack thread.
 *
 * @param request - The incoming callback request
 */
export async function POST(request: NextRequest) {
  if (redis.status !== "ready") {
    if (redis.status === "wait") {
      await redis.connect();
    } else {
      await new Promise<void>((resolve, reject) => {
        redis.once("ready", resolve);
        redis.once("error", reject);
      });
    }
  }
  return handleCodingAgentCallback(request);
}
