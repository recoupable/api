import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCodingAgentCallback } from "./validateCodingAgentCallback";
import { getThread } from "./getThread";
import { handlePRCreated } from "./handlePRCreated";

/**
 * Handles coding agent task callback from Trigger.dev.
 * Verifies the shared secret and dispatches based on callback status.
 *
 * @param request - The incoming callback request
 * @returns A NextResponse
 */
export async function handleCodingAgentCallback(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-callback-secret");
  const expectedSecret = process.env.CODING_AGENT_CALLBACK_SECRET;

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401, headers: getCorsHeaders() },
    );
  }

  const body = await request.json();
  const validated = validateCodingAgentCallback(body);

  if (validated instanceof NextResponse) {
    return validated;
  }

  const thread = getThread(validated.threadId);

  switch (validated.status) {
    case "pr_created":
      await handlePRCreated(validated.threadId, validated);
      break;

    case "no_changes":
      await thread.post("No changes were detected. The agent didn't modify any files.");
      break;

    case "failed":
      await thread.post(`Agent failed: ${validated.message ?? "Unknown error"}`);
      break;

    case "updated":
      await thread.setState({ snapshotId: validated.snapshotId });
      await thread.post("PRs updated with your feedback. Review the latest commits.");
      break;
  }

  return NextResponse.json({ status: "ok" }, { headers: getCorsHeaders() });
}
