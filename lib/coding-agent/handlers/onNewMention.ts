import type { CodingAgentBot } from "../bot";
import { buildTaskCard } from "../buildTaskCard";
import { triggerCodingAgent } from "@/lib/trigger/triggerCodingAgent";
import { triggerUpdatePR } from "@/lib/trigger/triggerUpdatePR";

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

      if (state?.status === "running" || state?.status === "updating") {
        await thread.post("I'm still working on this. I'll let you know when I'm done.");
        return;
      }

      if (state?.status === "pr_created" && state.snapshotId && state.branch && state.prs?.length) {
        await thread.setState({ status: "updating" });
        const handle = await triggerUpdatePR({
          feedback: message.text,
          snapshotId: state.snapshotId,
          branch: state.branch,
          repo: state.prs[0].repo,
          callbackThreadId: thread.id,
        });

        console.log("[coding-agent] triggerUpdatePR handle:", JSON.stringify(handle));
        const card = buildTaskCard("Updating PRs", "Got your feedback. Updating the PRs...", handle.id);
        console.log("[coding-agent] posting card:", JSON.stringify({ card }));
        await thread.post({ card });
        return;
      }

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
