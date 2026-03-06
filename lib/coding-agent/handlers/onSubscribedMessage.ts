import type { CodingAgentBot } from "../bot";
import { buildTaskCard } from "../buildTaskCard";
import { triggerUpdatePR } from "@/lib/trigger/triggerUpdatePR";

/**
 * Registers the onSubscribedMessage handler on the bot.
 * If the agent has created PRs, treats the message as feedback and
 * triggers the update-pr task. If the agent is currently working,
 * tells the user to wait.
 *
 * @param bot
 */
export function registerOnSubscribedMessage(bot: CodingAgentBot) {
  bot.onSubscribedMessage(async (thread, message) => {
    const state = await thread.state;

    if (!state) return;

    if (state.status === "running" || state.status === "updating") {
      await thread.post("I'm still working on this. I'll let you know when I'm done.");
      return;
    }

    if (state.status === "pr_created" && state.snapshotId && state.branch && state.prs?.length) {
      await thread.setState({ status: "updating" });

      const handle = await triggerUpdatePR({
        feedback: message.text,
        snapshotId: state.snapshotId,
        branch: state.branch,
        repo: state.prs[0].repo,
        callbackThreadId: thread.id,
      });

      const card = buildTaskCard("Updating PRs", "Got your feedback. Updating the PRs...", handle.id);
      await thread.post({ card });
    }
  });
}
