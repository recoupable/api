import type { SlackChatThreadState } from "../types";
import type { ChatRequestBody } from "@/lib/chat/validateChatRequest";
import { getMessages } from "@/lib/messages/getMessages";
import convertToUiMessages from "@/lib/messages/convertToUiMessages";
import { validateMessages } from "@/lib/chat/validateMessages";
import { setupConversation } from "@/lib/chat/setupConversation";
import { setupChatRequest } from "@/lib/chat/setupChatRequest";
import { saveChatCompletion } from "@/lib/chat/saveChatCompletion";

const ACCOUNT_ID = "cebcc866-34c3-451c-8cd7-f63309acff0a";

/**
 * Shared handler for both onNewMention and onSubscribedMessage.
 * Generates an AI response and posts it back to the Slack thread.
 *
 * @param thread - The Chat SDK thread instance
 * @param thread.state - Promise resolving to the current thread state
 * @param thread.post - Posts a message to the thread
 * @param thread.setState - Updates the thread state
 * @param text - The user's message text
 */
export async function handleSlackChatMessage(
  thread: {
    state: Promise<SlackChatThreadState | null>;
    post: (message: string) => Promise<unknown>;
    setState: (state: SlackChatThreadState) => Promise<void>;
  },
  text: string,
) {
  const currentState = await thread.state;

  // Prevent concurrent generation in the same thread
  if (currentState?.status === "generating") {
    await thread.post("I'm still working on a response. Please wait a moment.");
    return;
  }

  await thread.setState({
    status: "generating",
    prompt: text,
    roomId: currentState?.roomId,
  });

  await thread.post("Thinking...");

  // Get or create roomId from thread state
  const messages = getMessages(text, "user");
  const uiMessages = convertToUiMessages(messages);
  const { lastMessage } = validateMessages(uiMessages);

  const { roomId } = await setupConversation({
    accountId: ACCOUNT_ID,
    roomId: currentState?.roomId,
    topic: text.slice(0, 100),
    promptMessage: lastMessage,
    memoryId: lastMessage.id,
  });

  // Build ChatRequestBody (bypasses HTTP validation)
  const body: ChatRequestBody = {
    messages: uiMessages,
    accountId: ACCOUNT_ID,
    orgId: null,
    roomId,
    authToken: process.env.SLACK_CHAT_API_KEY!,
  };

  const chatConfig = await setupChatRequest(body);
  const result = await chatConfig.agent.generate(chatConfig);

  // Persist assistant response
  try {
    await saveChatCompletion({ text: result.text, roomId });
  } catch (error) {
    console.error("[slack-chat] Failed to persist assistant message:", error);
  }

  // Post response to Slack thread
  await thread.post(result.text);

  // Update thread state with roomId for conversational memory
  await thread.setState({
    status: "idle",
    prompt: text,
    roomId,
  });
}
