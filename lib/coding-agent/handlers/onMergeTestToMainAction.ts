import type { CodingAgentBot } from "../bot";
import { mergeGithubBranch } from "../mergeGithubBranch";
import { parseMergeTestToMainActionId } from "../parseMergeTestToMainActionId";

/**
 * Register On Merge Test To Main Action.
 *
 * @param bot - Value for bot.
 * @returns - Computed result.
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

    const result = await mergeGithubBranch(repo, "test", "main", token);

    if (result.ok === false) {
      const { message } = result;
      await thread.post(`❌ Failed to merge test → main for ${repo}: ${message}`);
      return;
    }

    await thread.post(`✅ Merged test → main for ${repo}.`);
  });
}
