import type { NextRequest } from "next/server";
import { handleGitHubWebhook } from "@/lib/coding-agent/handleGitHubWebhook";

/**
 * POST /api/coding-agent/github
 *
 * Webhook endpoint for GitHub PR comment feedback.
 * Receives issue_comment events and triggers update-pr when the bot is mentioned.
 *
 * @param request - The incoming GitHub webhook request
 * @returns A NextResponse indicating whether the webhook was processed
 */
export async function POST(request: NextRequest) {
  return handleGitHubWebhook(request);
}
