import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { createUIMessageStreamResponse } from "ai";
import { TERMINAL_WORKFLOW_RUN_STATUSES } from "@/lib/const";
import { parseStreamStartIndex } from "@/lib/chat/parseStreamStartIndex";
import { getChatWorkflowReadable } from "@/lib/chat/getChatWorkflowReadable";
import { wrapWorkflowStreamWatcher } from "@/lib/chat/wrapWorkflowStreamWatcher";
import { createNothingToResumeResponse } from "@/lib/chat/createNothingToResumeResponse";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { readOriginalChatLifecycle } from "./readOriginalChatLifecycle";
import { releaseFencedTerminalRun } from "./releaseFencedTerminalRun";
import type { ChatLifecycleTarget } from "./chatLifecycleTargetSchema";
/** Disabled read-only reconnect adapter; disconnect never cancels a workflow. */
export async function resumeFencedChatStream(
  input: ChatLifecycleTarget,
  url: URL,
): Promise<Response> {
  const startIndex = parseStreamStartIndex(url);
  if (startIndex instanceof NextResponse) return startIndex;
  const original = await readOriginalChatLifecycle(input);
  if (original.state === "pending")
    return errorResponse("Workflow is still starting; retry shortly", 503);
  if (original.state !== "running")
    return errorResponse(
      "Stream state is temporarily unresolved for this chat; retry shortly",
      503,
    );
  const target = original.target;
  let run, status;
  try {
    run = getRun(target.runId);
    status = await run.status;
  } catch {
    return errorResponse("Failed to read the workflow run", 502);
  }
  if (TERMINAL_WORKFLOW_RUN_STATUSES.includes(status)) {
    const released = await releaseFencedTerminalRun(target);
    if (released === "status_unresolved")
      return errorResponse("Failed to read the workflow run", 502);
    if (released !== "released")
      return errorResponse(
        "Stream state is temporarily unresolved for this chat; retry shortly",
        503,
      );
    return createNothingToResumeResponse();
  }
  if (status !== "running" && status !== "pending")
    return errorResponse("Failed to read the workflow run", 502);
  let readable;
  try {
    readable = getChatWorkflowReadable(run, { startIndex });
  } catch {
    return errorResponse("Failed to read the workflow run", 502);
  }
  let tailIndex: number | undefined;
  try {
    tailIndex = await readable.getTailIndex();
  } catch {
    /* Existing best-effort tail hint; not terminal evidence. */
  }
  return createUIMessageStreamResponse({
    stream: wrapWorkflowStreamWatcher(target.runId, readable, { cancelOnDisconnect: false }),
    headers: {
      ...getCorsHeaders(),
      "x-workflow-run-id": target.runId,
      ...(tailIndex === undefined ? {} : { "x-workflow-stream-tail-index": String(tailIndex) }),
    },
  });
}
