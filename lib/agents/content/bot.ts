import { Chat } from "chat";
import { SlackAdapter } from "@chat-adapter/slack";
import { agentLogger, createAgentState } from "@/lib/agents/createAgentState";
import type { ContentAgentThreadState } from "./types";
import { validateContentAgentEnv } from "./validateEnv";

type ContentAgentAdapters = {
  slack: SlackAdapter;
};

/**
 * Creates a new Chat bot instance configured with the Slack adapter
 * for the Recoup Content Agent.
 *
 * @returns The configured Chat bot instance
 */
export function createContentAgentBot() {
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

let _bot: ContentAgentBot | null = null;

/**
 * Returns the lazily-initialized content agent bot singleton.
 * Defers creation until first call so the Vercel build does not
 * crash when content-agent env vars are not yet configured.
 *
 * @returns The content agent bot singleton
 */
export function getContentAgentBot(): ContentAgentBot {
  if (!_bot) {
    _bot = createContentAgentBot().registerSingleton();
  }
  return _bot;
}
