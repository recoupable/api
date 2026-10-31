import type { UIMessageChunk } from "ai";
import type { Run, WorkflowReadableStream, WorkflowReadableStreamOptions } from "workflow/api";

/** Own the SDK reader's completion promises as well as its visible chunks. */
export function getChatWorkflowReadable(
  run: Pick<Run<unknown>, "getReadable">,
  options: Pick<WorkflowReadableStreamOptions, "startIndex"> = {},
): WorkflowReadableStream<UIMessageChunk> {
  const operations: Promise<unknown>[] = [];
  const source = run.getReadable<UIMessageChunk>({ ...options, ops: operations });
  const reader = source.getReader();
  // Forward a unique reason so only this subscription's own cancellation is
  // expected. An unrelated failure, including undefined, must remain visible.
  const cancellation = new Error("Chat reader subscription cancelled");
  let cancelled = false;
  let failed = false;
  let failure: unknown;
  let controller: ReadableStreamDefaultController<UIMessageChunk>;
  const reportFailure = (error: unknown) => {
    if (cancelled && error === cancellation) return;
    if (failed) return;
    failed = true;
    failure = error ?? new Error("Workflow reader operation failed");
    if (cancelled)
      console.error("[getChatWorkflowReadable] unexpected cancellation failure:", error);
    else {
      controller.error(failure);
      // A completion can fail before the visible read settles. Release that
      // subscription too; this never invokes run.cancel().
      void reader.cancel(failure).then(
        () => reader.releaseLock(),
        cleanupError => {
          console.error("[getChatWorkflowReadable] failed reader cleanup:", cleanupError);
          reader.releaseLock();
        },
      );
    }
  };
  let completion: Promise<void>;
  const readable = new ReadableStream<UIMessageChunk>({
    start(output) {
      controller = output;
      // getReadable registers its subscription completion synchronously. Attach
      // rejection handlers now, before any asynchronous read/cancel can settle it.
      completion = Promise.all(operations.map(operation => operation.catch(reportFailure))).then(
        () => {},
      );
    },
    async pull(output) {
      try {
        const next = await reader.read();
        if (cancelled || failed) return;
        if (next.done) {
          await completion;
          if (!cancelled && !failed) output.close();
          reader.releaseLock();
        } else output.enqueue(next.value);
      } catch (error) {
        reportFailure(error);
        reader.releaseLock();
      }
    },
    async cancel() {
      cancelled = true;
      try {
        await reader.cancel(cancellation);
        await completion;
        if (failed) throw failure;
      } finally {
        reader.releaseLock();
      }
    },
  });
  return Object.assign(readable, { getTailIndex: () => source.getTailIndex() });
}
