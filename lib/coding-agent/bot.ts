import { Chat } from "chat";
import { SlackAdapter } from "@chat-adapter/slack";
import { createWhatsAppAdapter, WhatsAppAdapter } from "@chat-adapter/whatsapp";
import { createGitHubAdapter } from "@chat-adapter/github";
import { agentLogger, createAgentState } from "@/lib/agents/createAgentState";
import type { CodingAgentThreadState } from "./types";
import { validateCodingAgentEnv } from "./validateEnv";
import { isWhatsAppConfigured } from "./whatsApp/isWhatsAppConfigured";

type CodingAgentAdapters = {
  slack: SlackAdapter;
  github: ReturnType<typeof createGitHubAdapter>;
  whatsapp?: WhatsAppAdapter;
};

/**
 * Creates a new Chat bot instance configured with Slack, GitHub, and optionally WhatsApp adapters.
 *
 * @returns The configured Chat bot instance
 */
export function createCodingAgentBot() {
  validateCodingAgentEnv();

  const state = createAgentState("coding-agent");

  const slack = new SlackAdapter({
    botToken: process.env.SLACK_BOT_TOKEN!,
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
    logger: agentLogger,
  });

  const github = createGitHubAdapter({
    token: process.env.GITHUB_TOKEN!,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
    userName: process.env.GITHUB_BOT_USERNAME ?? "recoup-coding-agent",
    logger: agentLogger,
  });

  const adapters: CodingAgentAdapters = { slack, github };

  if (isWhatsAppConfigured()) {
    adapters.whatsapp = createWhatsAppAdapter({ logger: agentLogger });
  }

  return new Chat<CodingAgentAdapters, CodingAgentThreadState>({
    userName: "Recoup Agent",
    adapters,
    state,
  });
}

export type CodingAgentBot = ReturnType<typeof createCodingAgentBot>;

/**
 * Singleton bot instance. Registers as the Chat SDK singleton
 * so ThreadImpl can resolve adapters lazily from thread IDs.
 */
export const codingAgentBot = createCodingAgentBot().registerSingleton();
