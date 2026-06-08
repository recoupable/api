import type { UIMessageChunk } from "ai";
import { getRun } from "workflow/api";
import type { CancellationPoller } from "@/lib/chat/pollWorkflowCancellation";

export interface PipeWorkflowStreamParams {
  uiStream: ReadableStream<UIMessageChunk>;
  writable: WritableStream<UIMessageChunk>;
  cancelController: AbortController;
  workflowRunId: string;
  poller: CancellationPoller;
}

/**
 * Pipes the agent's UIMessage stream to the workflow writable while detecting a
 * user-stop, returning whether the turn was aborted by the user.
 *
 * Distinguishing user-stop from natural completion: only the cancellation poller
 * aborts the controller before our own `finally` runs, so a `pipeTo` rejection
 * with the signal already aborted is the user-stop path. `pipeTo` can also resolve
 * cleanly on cancel (the workflow runtime closes the destination writable on
 * `run.cancel()`, which surfaces as a natural finish), so we additionally confirm
 * via the run's status. We capture this here rather than reading
 * `cancelController.signal.aborted` afterward, because the `finally` aborts the
 * controller unconditionally to stop the poller — which would otherwise make every
 * natural completion look like a user-stop.
 *
 * @returns true when the user stopped the run, false on natural completion.
 * @throws the original error on a genuine (non-abort) pipe failure.
 */
export async function pipeWorkflowStreamWithStopDetection({
  uiStream,
  writable,
  cancelController,
  workflowRunId,
  poller,
}: PipeWorkflowStreamParams): Promise<boolean> {
  let userAborted = false;
  try {
    await uiStream.pipeTo(writable, {
      preventClose: true,
      preventAbort: true,
      signal: cancelController.signal,
    });
    try {
      const status = await getRun(workflowRunId).status;
      if (status === "cancelled") {
        userAborted = true;
      }
    } catch {
      /* transient status read — treat as success */
    }
  } catch (err) {
    if (cancelController.signal.aborted) {
      userAborted = true;
    } else {
      throw err;
    }
  } finally {
    poller.stop();
    cancelController.abort();
    await poller.done.catch(() => {});
  }
  return userAborted;
}
