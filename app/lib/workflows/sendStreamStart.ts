import type { UIMessageChunk } from "ai";

/**
 * Emit the single `start` chunk that opens an assistant turn.
 *
 * Owned by the workflow body rather than by `runAgentStep`: the loop runs
 * one step per LLM call, and each step's `toUIMessageStream` is told
 * `sendStart: false`. Without this hoist the client would see one `start`
 * per iteration and render N assistant messages instead of one.
 *
 * Runs as a `"use step"` because stream I/O is illegal in workflow context.
 */
export async function sendStreamStart(
  writable: WritableStream<UIMessageChunk>,
  messageId: string,
): Promise<void> {
  "use step";

  const writer = writable.getWriter();
  try {
    await writer.write({ type: "start", messageId });
  } finally {
    writer.releaseLock();
  }
}
