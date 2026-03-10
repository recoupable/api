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
  bot.onAction("merge_test_to_main:", async event => {
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

    const result = await mergeGithubBranch(repo, "test", "main", token);

    if (result.ok === false) {
      const { message } = result;
      await thread.post(`❌ Failed to merge test → main for ${repo}: ${message}`);
      return;
    }

    await thread.post(`✅ Merged test → main for ${repo}.`);
  });
}
