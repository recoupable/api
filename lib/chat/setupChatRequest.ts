import { convertToModelMessages } from "ai";
import generateUUID from "@/lib/uuid/generateUUID";
import { MAX_MESSAGES } from "./const";
import { type ChatConfig } from "./types";
import { ChatRequestBody } from "./validateChatRequest";
import getGeneralAgent from "@/lib/agents/generalAgent/getGeneralAgent";

/**
 * Sets up and prepares the chat request configuration.
 *
 * This function:
 * 1. Gets the routing decision from getGeneralAgent
 * 2. Converts messages to model format
 * 3. Sets up provider options for different AI models
 * 4. Configures the prepareStep function for tool chain handling
 *
 * @param body - The validated chat request body
 * @returns ChatConfig ready for use with AI SDK
 */
export async function setupChatRequest(body: ChatRequestBody): Promise<ChatConfig> {
  const decision = await getGeneralAgent(body);

  const system = decision.instructions;
  const tools = decision.agent.tools;

  const convertedMessages = convertToModelMessages(body.messages, {
    tools,
    ignoreIncompleteToolCalls: true,
  }).slice(-MAX_MESSAGES);

  const config: ChatConfig = {
    ...decision,
    system,
    messages: convertedMessages,
    experimental_generateMessageId: generateUUID,
    tools,
  };

  return config;
}
