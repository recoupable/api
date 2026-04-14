import type { NextRequest } from "next/server";
import { handleGitHubWebhook } from "@/lib/coding-agent/handleGitHubWebhook";

/**
 * Handles POST requests.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
 */
export async function POST(request: NextRequest) {
  return handleGitHubWebhook(request);
}
