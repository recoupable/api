import { stepCountIs, ToolLoopAgent } from "ai";
import { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { DEFAULT_MODEL } from "@/lib/const";
import { RoutingDecision } from "@/lib/chat/types";
import { extractImageUrlsFromMessages } from "@/lib/messages/extractImageUrlsFromMessages";
import { buildSystemPromptWithImages } from "@/lib/chat/buildSystemPromptWithImages";
import { getSystemPrompt } from "@/lib/prompts/getSystemPrompt";
import { setupToolsForRequest } from "@/lib/chat/setupToolsForRequest";
import { ChatRequestBody } from "@/lib/chat/validateChatRequest";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectAccountInfo } from "@/lib/supabase/account_info/selectAccountInfo";
import { getKnowledgeBaseText } from "@/lib/files/getKnowledgeBaseText";
import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import getPrepareStepResult from "@/lib/chat/toolChains/getPrepareStepResult";

/**
 * Gets the general agent for the chat
 *
 * @param body - The chat request body
 * @returns The general agent
 */
export default async function getGeneralAgent(body: ChatRequestBody): Promise<RoutingDecision> {
  const { accountId, orgId, messages, artistId, model: bodyModel } = body;

  const accountEmails = await selectAccountEmails({ accountIds: accountId });
  const email = accountEmails[0]?.email || undefined;

  // Fetch artist instruction and knowledge base if artistId is provided
  let artistInstruction: string | undefined;
  let knowledgeBaseText: string | undefined;
  if (artistId) {
    const artistAccountInfo = await selectAccountInfo(artistId);
    artistInstruction = artistAccountInfo?.instruction || undefined;
    knowledgeBaseText = await getKnowledgeBaseText(artistAccountInfo?.knowledges);
  }

  const accountWithDetails = await getAccountWithDetails(accountId);
  const baseSystemPrompt = getSystemPrompt({
    roomId: body.roomId,
    artistId,
    accountId,
    orgId,
    email,
    artistInstruction,
    knowledgeBaseText,
    accountWithDetails,
  });
  const imageUrls = extractImageUrlsFromMessages(messages);
  const instructions = buildSystemPromptWithImages(baseSystemPrompt, imageUrls);

  const tools = await setupToolsForRequest(body);
  const model = bodyModel || DEFAULT_MODEL;
  const stopWhen = stepCountIs(111);

  const agent = new ToolLoopAgent({
    model,
    instructions,
    tools,
    stopWhen,
    prepareStep: options => {
      const next = getPrepareStepResult(options);
      if (next) return { ...options, ...next };
      return options;
    },
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 12000 },
      } satisfies AnthropicProviderOptions,
      google: {
        thinkingConfig: {
          thinkingBudget: 8192,
          includeThoughts: true,
        },
      } satisfies GoogleGenerativeAIProviderOptions,
      openai: {
        reasoningEffort: "medium",
        reasoningSummary: "detailed",
      } satisfies OpenAIResponsesProviderOptions,
    },
  });

  return {
    agent,
    model,
    instructions,
    stopWhen,
  };
}
