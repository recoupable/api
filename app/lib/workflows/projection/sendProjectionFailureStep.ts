import { FatalError } from "workflow";
import type { UIMessageChunk } from "ai";
/** Explicit failure, never Stop or an unqualified successful finish. No automatic stream reappend. */
export async function sendProjectionFailureStep(writable: WritableStream<UIMessageChunk>) {
  "use step";
  const writer = writable.getWriter();
  try {
    await writer.write({
      type: "error",
      errorText: "Required generation evidence is unavailable. This turn needs reconciliation.",
    });
    await writer.write({ type: "finish", finishReason: "error" });
  } catch {
    throw new FatalError("Projection failure stream acknowledgement unavailable");
  } finally {
    writer.releaseLock();
  }
}
