import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCodingAgentCallback } from "./validateCodingAgentCallback";
import type { CodingAgentCallbackBody } from "./validateCodingAgentCallback";
import { ThreadImpl } from "chat";
import type { CodingAgentThreadState } from "./types";

/**
 * Reconstructs a Thread from a stored thread ID using the Chat SDK singleton.
 *
 * @param threadId
 */
function getThread(threadId: string) {
  const adapterName = threadId.split(":")[0];
  const channelId = `${adapterName}:${threadId.split(":")[1]}`;
  return new ThreadImpl<CodingAgentThreadState>({
    adapterName,
    id: threadId,
    channelId,
  });
}

/**
 * Handles the pr_created callback status.
 *
 * @param threadId
 * @param body
 */
async function handlePRCreated(threadId: string, body: CodingAgentCallbackBody) {
  const thread = getThread(threadId);
  const prLinks = (body.prs ?? [])
    .map(pr => `- [${pr.repo}#${pr.number}](${pr.url}) → \`${pr.baseBranch}\``)
    .join("\n");

  await thread.post(
    `PRs created:\n${prLinks}\n\nReply in this thread to give feedback, or click Merge when ready.`,
  );

  await thread.setState({
    status: "pr_created",
    branch: body.branch,
    snapshotId: body.snapshotId,
    prs: body.prs,
  });
}

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
