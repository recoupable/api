import { ThreadImpl } from "chat";
import type { CodingAgentThreadState } from "./types";

/**
 * Reconstructs a Thread from a stored thread ID using the Chat SDK singleton.
 *
 * @param threadId
 */
export function getThread(threadId: string) {
  const adapterName = threadId.split(":")[0];
  const channelId = `${adapterName}:${threadId.split(":")[1]}`;
  return new ThreadImpl<CodingAgentThreadState>({
    adapterName,
    id: threadId,
    channelId,
  });
}
