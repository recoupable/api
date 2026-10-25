import { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { waitForTerminalRunStatus } from "@/lib/chat/waitForTerminalRunStatus";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { readOriginalChatLifecycle } from "./readOriginalChatLifecycle";
import { releaseFencedTerminalRun } from "./releaseFencedTerminalRun";
import type { ChatLifecycleTarget } from "./chatLifecycleTargetSchema";
/** Disabled internal adapter. Caller must authorize the captured original chat/account; no public producer. */
export async function stopFencedChatWorkflow(input: ChatLifecycleTarget): Promise<NextResponse> {
  const original = await readOriginalChatLifecycle(input);
  if (original.state === "pending") {
    const { chatId, effectiveAccount, epoch, owner } = original.target;
    const result = await executeChatFenceCommand(chatId, effectiveAccount, {
      action: "close_unattempted",
      payload: { epoch, owner },
    });
    // False, malformed, failed or lost acknowledgement grants no follow-up effects.
    if (result.ok && result.action === "close_unattempted" && result.value.closed)
      return NextResponse.json(
        { success: true, stopped: true },
        { status: 200, headers: getCorsHeaders() },
      );
    return errorResponse("Workflow is still starting; retry Stop shortly", 503);
  }
  if (original.state !== "running")
    return errorResponse(
      "Stream state is temporarily unresolved for this chat; retry shortly",
      503,
    );
  const target = original.target;
  try {
    await getRun(target.runId).cancel();
  } catch {
    return errorResponse("Failed to stop the workflow", 502);
  }
  if (!(await waitForTerminalRunStatus(target.runId)))
    return errorResponse("Workflow did not terminate in time", 504);
  const released = await releaseFencedTerminalRun(target);
  if (released === "status_unresolved")
    return errorResponse("Workflow did not terminate in time", 504);
  if (released !== "released")
    return errorResponse(
      "Stream state is temporarily unresolved for this chat; retry shortly",
      503,
    );
  return NextResponse.json(
    { success: true, stopped: true },
    { status: 200, headers: getCorsHeaders() },
  );
}
