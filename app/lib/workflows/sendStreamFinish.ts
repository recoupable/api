import type { UIMessageChunk } from "ai";

/**
 * Emit the single `finish` chunk that closes an assistant turn.
 *
 * Counterpart to `sendStreamStart` — see that file for why the envelope
 * lives in the workflow body rather than in each `runAgentStep`.
 *
 * Runs as a `"use step"` because stream I/O is illegal in workflow context.
 */
export async function sendStreamFinish(writable: WritableStream<UIMessageChunk>): Promise<void> {
  "use step";

  const writer = writable.getWriter();
  try {
    await writer.write({ type: "finish" });
  } finally {
    writer.releaseLock();
  }
}
