import type { UIMessageChunk } from "ai";
import { hasAutoCommitChanges } from "@/lib/chat/auto-commit/hasAutoCommitChanges";
import { runAutoCommit } from "@/lib/chat/auto-commit/runAutoCommit";
import { sendCommitChunk } from "@/lib/chat/auto-commit/sendCommitChunk";
import { buildCommitData } from "@/lib/chat/auto-commit/buildCommitData";
import { persistAssistantDataPart } from "@/lib/chat/persistAssistantDataPart";
import type { SandboxState } from "@/lib/sandbox/factory";

interface AssistantMessage {
  id: string;
  role: string;
  parts: ReadonlyArray<unknown>;
}

export interface AutoCommitChatTurnInput {
  writable: WritableStream<UIMessageChunk>;
  responseMessage: AssistantMessage;
  finishReason: string | undefined;
  sessionId: string;
  sessionTitle?: string;
  repoOwner?: string;
  repoName?: string;
  /**
   * Discriminated SandboxState (already wrapped with the `type` tag
   * by the caller — DurableAgentContext carries the raw VercelState
   * so the workflow body composes the SandboxState before calling
   * here).
   */
  sandboxState?: SandboxState;
}

/**
 * Runs the full auto-commit flow at the tail of a successful chat
 * turn: gates on `canAutoCommit`, checks for sandbox changes, emits
 * the `data-commit` chunks (pending → resolved), runs the
 * sandbox-side commit + push, and persists the resolved part onto
 * the assistant message so the `GitDataPartCard` UI renders on
 * page refresh.
 *
 * Extracted from `runAgentWorkflow` so the workflow body stays a
 * thin orchestrator. Mirrors open-agents'
 * `apps/web/app/workflows/chat.ts:canAutoCommit` block.
 *
 * Skips silently when:
 *   - finishReason is `"tool-calls"` (intermediate turn, not natural finish)
 *   - either `repoOwner` or `repoName` is missing (no GitHub link to make)
 *   - `sandboxState` is missing (no sandbox to commit in)
 *   - `hasAutoCommitChanges` returns false (`git status --porcelain` empty)
 *
 * Never throws — the inner steps swallow their errors and surface
 * the result via `AutoCommitResult.error`, which `buildCommitData`
 * shapes into a `status: "error"` chunk that's still persisted so
 * the UI shows "Commit failed" on refresh.
 */
export async function autoCommitChatTurn(input: AutoCommitChatTurnInput): Promise<void> {
  const canAutoCommit =
    input.finishReason !== "tool-calls" &&
    input.repoOwner !== undefined &&
    input.repoName !== undefined &&
    input.sandboxState !== undefined;
  if (!canAutoCommit) return;

  const hasChanges = await hasAutoCommitChanges({
    sandboxState: input.sandboxState!,
  });
  if (!hasChanges) return;

  const commitPartId = `${input.responseMessage.id}:commit`;

  // Emit the pending chunk BEFORE the commit step so the UI can
  // show a spinner while git add/commit/push run.
  await sendCommitChunk(input.writable, commitPartId, {
    status: "pending",
    committed: false,
    pushed: false,
  });

  const commitResult = await runAutoCommit({
    sessionId: input.sessionId,
    sessionTitle: input.sessionTitle ?? "",
    repoOwner: input.repoOwner!,
    repoName: input.repoName!,
    sandboxState: input.sandboxState!,
  });
  const resolvedData = buildCommitData(commitResult, input.repoOwner!, input.repoName!);
  await sendCommitChunk(input.writable, commitPartId, resolvedData);

  // Persist the resolved data-commit part onto the assistant
  // message so the GitDataPartCard renders on page refresh.
  await persistAssistantDataPart(input.responseMessage, {
    type: "data-commit",
    id: commitPartId,
    data: resolvedData,
  });
}
