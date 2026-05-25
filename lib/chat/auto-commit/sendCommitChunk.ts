import type { UIMessageChunk } from "ai";
import type { CommitData } from "@/lib/chat/auto-commit/buildCommitData";

/**
 * Emits a `data-commit` UIMessageChunk into the chat workflow's
 * writable. Wrapped as a `"use step"` so the chunk flushes durably to
 * the SSE client before the workflow moves on (e.g., the "pending"
 * status appears in the UI before `runAutoCommit` starts).
 *
 * Mirrors open-agents'
 * `apps/web/app/workflows/chat.ts:sendDataPart`.
 */
export async function sendCommitChunk(
  writable: WritableStream<UIMessageChunk>,
  id: string,
  data: CommitData,
): Promise<void> {
  "use step";
  const writer = writable.getWriter();
  try {
    await writer.write({ type: "data-commit", id, data } as UIMessageChunk);
  } finally {
    writer.releaseLock();
  }
}
