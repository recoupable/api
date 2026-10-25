import { getRun } from "workflow/api";
import { TERMINAL_WORKFLOW_RUN_STATUSES } from "@/lib/const";
import { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { captureChatLifecycleTarget } from "./captureChatLifecycleTarget";
import type { RunningChatLifecycleTarget } from "./chatLifecycleTargetSchema";
/** Read authoritative SDK status here; callers cannot manufacture terminal evidence. */
export async function releaseFencedTerminalRun(
  input: RunningChatLifecycleTarget,
): Promise<"released" | "status_unresolved" | "release_unresolved"> {
  let target;
  try {
    target = captureChatLifecycleTarget(input);
    if (target.phase !== "running") return "status_unresolved";
    const status = await getRun(target.runId).status;
    if (!TERMINAL_WORKFLOW_RUN_STATUSES.includes(status)) return "status_unresolved";
  } catch {
    return "status_unresolved";
  }
  // The read above can race a new owner. The original token, never current state, gates release.
  try {
    const result = await executeChatFenceCommand(target.chatId, target.effectiveAccount, {
      action: "release",
      payload: {
        epoch: target.epoch,
        owner: target.owner,
        run_id: target.runId,
        reason: "external_terminal",
      },
    });
    return result.ok === true && result.action === "release" && result.value.released
      ? "released"
      : "release_unresolved";
  } catch {
    return "release_unresolved";
  }
}
