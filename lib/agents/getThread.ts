import { ThreadImpl } from "chat";

const THREAD_ID_PATTERN = /^[^:]+:[^:]+:[^:]+$/;

/**
 * Reconstructs a Thread from a stored thread ID using the Chat SDK singleton.
 * Shared across agent bots (coding-agent, content-agent).
 *
 * @param threadId - The stored thread identifier (format: adapter:channel:thread)
 * @returns The reconstructed Thread instance
 * @throws If threadId does not match the expected adapter:channel:thread format
 */
export function getThread<TState = Record<string, unknown>>(threadId: string) {
  if (!THREAD_ID_PATTERN.test(threadId)) {
    throw new Error(
      `Invalid threadId format: expected "adapter:channel:thread", got "${threadId}"`,
    );
  }

  const parts = threadId.split(":");
  const adapterName = parts[0];
  const channelId = `${adapterName}:${parts[1]}`;

  return new ThreadImpl<TState>({
    adapterName,
    id: threadId,
    channelId,
  });
}
