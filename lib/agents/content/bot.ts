import { Chat } from "chat";
import { SlackAdapter } from "@chat-adapter/slack";
import { agentLogger, createAgentState } from "@/lib/agents/createAgentState";
import type { ContentAgentThreadState } from "./types";
import { isContentAgentConfigured } from "./isContentAgentConfigured";
import { validateContentAgentEnv } from "./validateContentAgentEnv";

type ContentAgentAdapters = {
  slack: SlackAdapter;
};

/**
 * Creates a new Chat bot instance configured with the Slack adapter
 * for the Recoup Content Agent.
 *
 * @returns The configured Chat bot instance
 */
function createContentAgentBot() {
  validateContentAgentEnv();

  const state = createAgentState("content-agent");

  const slack = new SlackAdapter({
    botToken: process.env.SLACK_CONTENT_BOT_TOKEN!,
    signingSecret: process.env.SLACK_CONTENT_SIGNING_SECRET!,
    logger: agentLogger,
  });

  return new Chat<ContentAgentAdapters, ContentAgentThreadState>({
    userName: "Recoup Content Agent",
    adapters: { slack },
    state,
  });
}

export type ContentAgentBot = ReturnType<typeof createContentAgentBot>;

/**
 * Singleton bot instance. Only created when content agent env vars are configured.
 * Registers as the Chat SDK singleton so ThreadImpl can resolve adapters lazily from thread IDs.
 */
export const contentAgentBot: ContentAgentBot | null = isContentAgentConfigured()
  ? createContentAgentBot().registerSingleton()
  : null;
