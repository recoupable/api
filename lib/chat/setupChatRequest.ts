import { convertToModelMessages } from "ai";
import { MAX_MESSAGES } from "./const";
import { type ChatConfig } from "./types";
import { ChatRequestBody } from "./validateChatRequest";
import getGeneralAgent from "@/lib/agents/generalAgent/getGeneralAgent";

/**
 * Sets up and prepares the chat request configuration.
 *
 * This function:
 * 1. Gets the routing decision (agent, model, tools) from getGeneralAgent
 * 2. Converts UI messages to model format, truncated to MAX_MESSAGES
 * 3. Assembles the ChatConfig for use with agent.generate() or agent.stream()
 *
 * @param body - The validated chat request body
 * @returns ChatConfig ready for use with AI SDK
 */
export async function setupChatRequest(body: ChatRequestBody): Promise<ChatConfig> {
  const decision = await getGeneralAgent(body);

  const convertedMessages = convertToModelMessages(body.messages, {
    tools: decision.agent.tools,
    ignoreIncompleteToolCalls: true,
  }).slice(-MAX_MESSAGES);

  return {
    agent: decision.agent,
    messages: convertedMessages,
  };
}
