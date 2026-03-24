import { ThreadImpl } from "chat";
import type { ContentAgentThreadState } from "./types";

/**
 * Reconstructs a Thread from a stored thread ID using the Chat SDK singleton.
 *
 * @param threadId - The stored thread identifier (format: adapter:channel:thread)
 * @returns The reconstructed Thread instance
 */
export function getThread(threadId: string) {
  const adapterName = threadId.split(":")[0];
  const channelId = `${adapterName}:${threadId.split(":")[1]}`;
  return new ThreadImpl<ContentAgentThreadState>({
    adapterName,
    id: threadId,
    channelId,
  });
}
