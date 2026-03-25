import { getThread as getAgentThread } from "@/lib/agents/getThread";
import type { CodingAgentThreadState } from "./types";

/**
 * Reconstructs a Thread from a stored thread ID using the Chat SDK singleton.
 *
 * @param threadId
 */
export function getThread(threadId: string) {
  return getAgentThread<CodingAgentThreadState>(threadId);
}
