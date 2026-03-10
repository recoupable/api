import type { CodingAgentBot } from "../bot";
import { mergeGithubBranch } from "../mergeGithubBranch";
import { parseMergeTestToMainActionId } from "../parseMergeTestToMainActionId";

/**
 * Registers the "Merge test to main" button action handler on the bot.
 * Merges the test branch into main for the specified repo via the GitHub API.
 *
 * @param bot
 */
export function registerOnMergeTestToMainAction(bot: CodingAgentBot) {
  bot.onAction(async event => {
    if (!event.actionId.startsWith("merge_test_to_main:")) return;

    const thread = event.thread;

    const repo = parseMergeTestToMainActionId(event.actionId);
    if (!repo) {
      await thread.post("Invalid merge test to main action.");
      return;
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      await thread.post("Missing GITHUB_TOKEN — cannot merge branches.");
      return;
    }

    // Fire-and-forget so the Slack interaction responds within 3 seconds
    mergeGithubBranch(repo, "test", "main", token).then(async result => {
      if (result.ok === false) {
        await thread.post(`❌ Failed to merge test → main for ${repo}: ${result.message}`);
        return;
      }
      await thread.post(`✅ Merged test → main for ${repo}.`);
    });
  });
}
