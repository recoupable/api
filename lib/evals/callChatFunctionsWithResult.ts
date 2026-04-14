import { UIMessage } from "ai";
import { DEFAULT_MODEL, EVAL_ACCOUNT_ID, EVAL_ACCESS_TOKEN } from "@/lib/consts";
import { setupChatRequest } from "@/lib/chat/setupChatRequest";
import { ChatRequestBody } from "@/lib/chat/validateChatRequest";

/**
 * Call Chat Functions With Result.
 *
 * @param input - Value for input.
 * @returns - Computed result.
 */
export async function callChatFunctionsWithResult(input: string) {
  const messages: UIMessage[] = [
    {
      id: "user-message",
      role: "user",
      parts: [
        {
          type: "text",
          text: input,
        },
      ],
    },
  ];

  const body: ChatRequestBody = {
    messages,
    roomId: "3779c62e-7583-40c6-a0bb-6bbac841a531",
    accountId: EVAL_ACCOUNT_ID,
    authToken: EVAL_ACCESS_TOKEN,
    orgId: null,
    artistId: "29cfd55a-98d9-45a5-96c9-c751a88f7799",
    model: DEFAULT_MODEL,
    excludeTools: [], // Don't exclude any tools - we want to test tool usage
  };

  const { agent, messages: convertedMessages } = await setupChatRequest(body);
  const result = await agent.generate({ messages: convertedMessages });

  // Collect tool calls from ALL steps, not just the last one
  const allToolCalls = result.steps?.flatMap(step => step.toolCalls || []) || result.toolCalls;

  // Return result with all tool calls from all steps
  return {
    ...result,
    toolCalls: allToolCalls,
  };
}
