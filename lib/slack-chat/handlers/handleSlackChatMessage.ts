import type { SlackChatThreadState } from "../types";
import type { ChatRequestBody } from "@/lib/chat/validateChatRequest";
import { getMessages } from "@/lib/messages/getMessages";
import convertToUiMessages from "@/lib/messages/convertToUiMessages";
import { validateMessages } from "@/lib/chat/validateMessages";
import { setupConversation } from "@/lib/chat/setupConversation";
import { setupChatRequest } from "@/lib/chat/setupChatRequest";
import { saveChatCompletion } from "@/lib/chat/saveChatCompletion";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import selectMemories from "@/lib/supabase/memories/selectMemories";

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

  const authToken = process.env.SLACK_CHAT_API_KEY!;

  // Derive account from the API key — no hardcoded account ID
  const keyDetails = await getApiKeyDetails(authToken);
  if (!keyDetails) {
    console.error("[slack-chat] Invalid SLACK_CHAT_API_KEY — could not resolve account");
    await thread.post("Sorry, I'm not configured correctly. Please contact support.");
    return;
  }

  const { accountId, orgId } = keyDetails;

  await thread.setState({
    status: "generating",
    prompt: text,
    roomId: currentState?.roomId,
  });

  await thread.post("Thinking...");

  // Build current message as UIMessage
  const newMessages = getMessages(text, "user");
  const newUiMessages = convertToUiMessages(newMessages);
  const { lastMessage } = validateMessages(newUiMessages);

  // Setup conversation: create room if needed, persist user message
  const { roomId } = await setupConversation({
    accountId,
    roomId: currentState?.roomId,
    topic: text.slice(0, 100),
    promptMessage: lastMessage,
    memoryId: lastMessage.id,
  });

  // Load full conversation history from the room (includes the message we just saved)
  const memories = await selectMemories(roomId, { ascending: true });
  const historyMessages = (memories ?? [])
    .filter(m => {
      const content = m.content as unknown as { role?: string; parts?: unknown[] };
      return content?.role && content?.parts;
    })
    .map(m => {
      const content = m.content as unknown as {
        role: string;
        parts: { type: string; text?: string }[];
      };
      return {
        id: m.id,
        role: content.role as "user" | "assistant" | "system",
        parts: content.parts,
      };
    });

  const allUiMessages = convertToUiMessages(
    historyMessages.length > 0 ? historyMessages : newUiMessages,
  );

  // Build ChatRequestBody — accountId inferred from API key
  const body: ChatRequestBody = {
    messages: allUiMessages,
    accountId,
    orgId,
    roomId,
    authToken,
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
