import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCodingAgentCallback } from "./validateCodingAgentCallback";
import { getThread } from "./getThread";
import { handlePRCreated } from "./handlePRCreated";
import { buildPRCard } from "./buildPRCard";
import type { CodingAgentThreadState } from "./types";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

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
      await thread.setState({ status: "no_changes" });
      await thread.post("No changes were detected. The agent didn't modify any files.");
      break;

    case "failed":
      await thread.setState({ status: "failed" });
      await thread.post(`Agent failed: ${validated.message ?? "Unknown error"}`);
      break;

    case "updated": {
      const state = (await thread.state) as CodingAgentThreadState | null;
      await thread.setState({ status: "pr_created", snapshotId: validated.snapshotId });
      const prs = state?.prs ?? [];
      const card = buildPRCard("PRs Updated", prs);
      await thread.post({ card });
      break;
    }
  }

  return NextResponse.json({ status: "ok" }, { headers: getCorsHeaders() });
}
