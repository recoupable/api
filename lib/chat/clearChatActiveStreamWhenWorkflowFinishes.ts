import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";

type RunLike = {
  runId: string;
  returnValue: Promise<unknown>;
};

/**
 * Wait for a `start(workflow, ...)` run to finish, then CAS-clear
 * `chats.active_stream_id` back to null **only if** it still holds
 * this run's id.
 *
 * Why: the chat UI uses `chats.active_stream_id !== null` as a proxy
 * for "is this chat still streaming" (via
 * `GET /api/sessions/{sessionId}/chats`). Without this cleanup, the
 * field stays set after the workflow finishes, the recovery probe
 * keeps reporting `isStreaming: true`, and the client's
 * auto-resume keeps the AI SDK `chat.status` stuck in `submitted` /
 * `streaming` — so the send button never returns and follow-up
 * messages are blocked.
 *
 * Designed to be scheduled with `after(...)` from the handler so it
 * runs past the response return without blocking the stream. The
 * CAS guard (`expected = run.runId`) makes it safe to fire even if
 * the user already kicked off another run for the same chat in the
 * meantime — that newer run owns the slot and shouldn't be wiped.
 *
 * Workflow failures, cancellations, and successful completions all
 * trigger the same clear. The `returnValue` promise rejects on
 * cancel / failure, so we swallow the rejection and proceed to the
 * CAS — same behavior as success.
 */
export async function clearChatActiveStreamWhenWorkflowFinishes(params: {
  chatId: string;
  run: RunLike;
}): Promise<void> {
  const { chatId, run } = params;

  await run.returnValue.catch(() => undefined);

  const cleared = await compareAndSetChatActiveStreamId(chatId, run.runId, null);
  if (cleared.ok === false) {
    console.error(
      `[clearChatActiveStreamWhenWorkflowFinishes] CAS error chatId=${chatId} runId=${run.runId}: ${cleared.error}`,
    );
    return;
  }
  // cleared.claimed === false means the race was lost — another run owns
  // the slot now. Nothing to do.
}
