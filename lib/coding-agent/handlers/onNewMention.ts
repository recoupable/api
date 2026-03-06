import { Card, CardText, Actions, LinkButton } from "chat";
import type { CodingAgentBot } from "../bot";
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
        await thread.post("Got your feedback. Updating the PRs...");
        await thread.setState({ status: "updating" });
        await triggerUpdatePR({
          feedback: message.text,
          snapshotId: state.snapshotId,
          branch: state.branch,
          repo: state.prs[0].repo,
          callbackThreadId: thread.id,
        });
        return;
      }

      const prompt = message.text;
      await thread.subscribe();

      const handle = await triggerCodingAgent({
        prompt,
        callbackThreadId: thread.id,
      });

      const card = Card({
        title: "Task Started",
        children: [
          CardText(`Starting work on: "${prompt}"\n\nI'll reply here when done.`),
          Actions([
            LinkButton({ url: `https://chat.recoupable.com/tasks/${handle.id}`, label: "View Task" }),
          ]),
        ],
      });

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
