import type { CodingAgentBot } from "../bot";
import { buildTaskCard } from "../buildTaskCard";
import { triggerCodingAgent } from "@/lib/trigger/triggerCodingAgent";
import { handleFeedback } from "./handleFeedback";

/**
 * Registers the onNewMention handler on the bot.
 * If the thread already has PRs, treats the mention as feedback and
 * triggers the update-pr task. Otherwise, starts a new coding agent task.
 *
 * @param bot
 */
export function registerOnNewMention(bot: CodingAgentBot) {
  bot.onNewMention(async (thread, message) => {
    try {
      const state = await thread.state;

      if (await handleFeedback(thread, message.text, state)) return;

      const prompt = message.text;
      await thread.subscribe();

      const handle = await triggerCodingAgent({
        prompt,
        callbackThreadId: thread.id,
      });

      const card = buildTaskCard("Task Started", `Starting work on: "${prompt}"\n\nI'll reply here when done.`, handle.id);
      await thread.post({ card });

      await thread.setState({
        status: "running",
        prompt,
        runId: handle.id,
        slackThreadId: thread.id,
      });
    } catch (error) {
      console.error("[coding-agent] onNewMention error:", error);
    }
  });
}
