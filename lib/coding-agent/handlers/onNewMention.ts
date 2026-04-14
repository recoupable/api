import type { CodingAgentBot } from "../bot";
import { buildTaskCard } from "@/lib/agents/buildTaskCard";
import { triggerCodingAgent } from "@/lib/trigger/triggerCodingAgent";
import { resolvePRState } from "../resolvePRState";
import { handleFeedback } from "./handleFeedback";

/**
 * Register On New Mention.
 *
 * @param bot - Parameter.
 * @returns - Result.
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
      });
    } catch (error) {
      console.error("[coding-agent] onNewMention error:", error);
    }
  });
}
