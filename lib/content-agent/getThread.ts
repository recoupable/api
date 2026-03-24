import { ThreadImpl } from "chat";
import type { ContentAgentThreadState } from "./types";

const THREAD_ID_PATTERN = /^[^:]+:[^:]+:[^:]+$/;

/**
 * Reconstructs a Thread from a stored thread ID using the Chat SDK singleton.
 *
 * @param threadId - The stored thread identifier (format: adapter:channel:thread)
 * @returns The reconstructed Thread instance
 * @throws If threadId does not match the expected adapter:channel:thread format
 */
export function getThread(threadId: string) {
  if (!THREAD_ID_PATTERN.test(threadId)) {
    throw new Error(
      `[content-agent] Invalid threadId format: expected "adapter:channel:thread", got "${threadId}"`,
    );
  }

  const parts = threadId.split(":");
  const adapterName = parts[0];
  const channelId = `${adapterName}:${parts[1]}`;

  return new ThreadImpl<ContentAgentThreadState>({
    adapterName,
    id: threadId,
    channelId,
  });
}
