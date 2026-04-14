import type { NextRequest } from "next/server";
import { handleGitHubWebhook } from "@/lib/coding-agent/handleGitHubWebhook";

/**
 * POST.
 *
 * @param request - Parameter.
 * @returns - Result.
 */
export async function POST(request: NextRequest) {
  return handleGitHubWebhook(request);
}
