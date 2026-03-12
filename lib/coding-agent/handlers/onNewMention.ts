import type { CodingAgentBot } from "../bot";
import { buildTaskCard } from "../buildTaskCard";
import { triggerCodingAgent } from "@/lib/trigger/triggerCodingAgent";
import { resolvePRState } from "../resolvePRState";
import { handleFeedback } from "./handleFeedback";

/**
 * Registers the onNewMention handler on the bot.
 * If the thread already has PRs (via thread state or shared PR state key),
 * treats the mention as feedback and triggers the update-pr task.
 * Otherwise, starts a new coding agent task.
 *
 * For GitHub PR comments, message.meta may contain { repo, branch } to look up
 * the shared PR state key when thread state is empty.
 *
 * @param bot
 */
export function registerOnNewMention(bot: CodingAgentBot) {
  bot.onNewMention(async (thread, message) => {
    try {
      const raw = message.raw as { repo?: string; branch?: string } | undefined;
      const prContext =
        raw?.repo && raw?.branch ? { repo: raw.repo, branch: raw.branch } : undefined;
      const state = await resolvePRState(thread, prContext);

      if (await handleFeedback(thread, message.text, state)) return;

      const prompt = message.text;
      await thread.subscribe();

      const handle = await triggerCodingAgent({
        prompt,
        callbackThreadId: thread.id,
      });

      const card = buildTaskCard(
        "Task Started",
        `Starting work on: "${prompt}"\n\nI'll reply here when done.`,
        handle.id,
      );
      await thread.post({ card });

      await thread.setState({
        status: "running",
        prompt,
        runId: handle.id,
        threadId: thread.id,
        slackThreadId: thread.id,
      });
    } catch (error) {
      console.error("[coding-agent] onNewMention error:", error);
    }
  });
}
