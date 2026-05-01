import type { NextRequest } from "next/server";
import { handleGitHubWebhook } from "@/lib/coding-agent/handleGitHubWebhook";

/**
 * POST /api/coding-agent/github
 *
 * Webhook endpoint for GitHub PR comment feedback. Receives `issue_comment` events
 * and triggers the `update-pr` coding agent task when the bot is @-mentioned in a
 * comment. Authentication relies on the GitHub `X-Hub-Signature-256` signature that
 * `handleGitHubWebhook` validates against the webhook secret.
 *
 * @param request - The incoming GitHub webhook POST. Headers `X-GitHub-Event` and
 *   `X-Hub-Signature-256` are required; the JSON body is the raw GitHub event
 *   payload (typically `issue_comment`).
 * @returns A NextResponse JSON payload with a `status` field indicating outcome
 *   (`update_triggered`, `ignored`, `busy`, `no_state`, or `updating`) on 200;
 *   `{ status: "error", error }` with 401 when signature validation fails; and
 *   `{ status: "error", error }` with 500 on internal failure.
 */
export async function POST(request: NextRequest) {
  return handleGitHubWebhook(request);
}
