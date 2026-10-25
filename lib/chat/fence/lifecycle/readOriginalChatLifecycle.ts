import { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { captureChatLifecycleTarget } from "./captureChatLifecycleTarget";
import type { ChatLifecycleTarget, RunningChatLifecycleTarget } from "./chatLifecycleTargetSchema";
export type OriginalChatLifecycle =
  | { state: "pending"; target: Extract<ChatLifecycleTarget, { phase: "pending" }> }
  | { state: "unresolved" }
  | { state: "running"; target: RunningChatLifecycleTarget };
/** Comparison only. Pending observations never confer atomic no-start permission. */
export async function readOriginalChatLifecycle(
  input: ChatLifecycleTarget,
): Promise<OriginalChatLifecycle> {
  try {
    const target = captureChatLifecycleTarget(input);
    // Do not infer dispatch history. Only Stop may submit the atomic original-token close.
    if (target.phase === "pending") return { state: "pending", target };
    const result = await executeChatFenceCommand(target.chatId, target.effectiveAccount, {
      action: "state",
      payload: {},
    });
    if (result.ok === false || result.action !== "state") return { state: "unresolved" };
    const observed = result.value;
    if (
      observed.phase !== "running" ||
      observed.epoch !== target.epoch ||
      observed.owner !== target.owner ||
      observed.run_id !== target.runId
    )
      return { state: "unresolved" };
    return { state: "running", target };
  } catch {
    return { state: "unresolved" };
  }
}
