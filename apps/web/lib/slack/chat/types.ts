/**
 * Thread state for the Slack chat bot.
 * Stored in Redis via Chat SDK's state adapter.
 */
export interface SlackChatThreadState {
  status: "idle" | "generating";
  prompt: string;
  /** Persists across thread messages so the chat has memory. */
  roomId?: string;
}
