import type { UIMessageChunk } from "ai";

/**
 * Vercel Workflow `"use step"` that explicitly closes the chat
 * workflow's writable.
 *
 * The chat workflow streams `UIMessageChunk`s to the client over an
 * SSE response backed by `getWritable<UIMessageChunk>()`. After
 * `runAgentStep` finishes writing the last chunk, the writer is
 * released but the underlying writable is NOT closed — so the SSE
 * response holds its HTTP connection open and the client's AI SDK
 * chat hook keeps `chat.status` in `"submitted"` waiting on a
 * stream-end signal that doesn't arrive until Vercel Workflow's
 * runtime garbage-collects the run minutes later.
 *
 * Calling `writable.close()` from inside the workflow body (as a
 * step) signals end-of-stream immediately. Mirrors open-agents'
 * `closeStream` step in `app/workflows/chat.ts`.
 *
 * Defensively swallows errors: if the stream is already closed
 * (race with auto-close, or a prior step closed it) we don't want
 * a cleanup hiccup to fail the workflow. The clear step running
 * alongside is what actually matters for state correctness.
 *
 * @param writable - The workflow's UIMessageChunk writable.
 */
export async function closeChatStream(writable: WritableStream<UIMessageChunk>): Promise<void> {
  "use step";
  try {
    await writable.close();
  } catch (error) {
    console.warn("[closeChatStream] writable.close() failed:", error);
  }
}
