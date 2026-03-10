import type { CodingAgentBot } from "../bot";
import type { CodingAgentThreadState } from "../types";
import { handleMergeSuccess } from "../handleMergeSuccess";
import { parseMergeActionId } from "../parseMergeActionId";
import { mergeGithubPR } from "../mergeGithubPR";
import { buildMergeTestToMainCard } from "../buildMergeTestToMainCard";

/**
 * Registers individual per-PR merge button action handlers on the bot.
 * Each button has an ID like "merge_pr:<repo>#<number>" and squash-merges
 * that single PR via the GitHub API.
 *
 * When a PR targeting the "test" branch is merged, a follow-up
 * "Merge test to main" button is presented.
 *
 * Uses a prefix pattern so a single handler covers all merge_pr:* actions.
 *
 * @param bot
 */
export function registerOnMergeAction(bot: CodingAgentBot) {
  bot.onAction(async event => {
    if (!event.actionId.startsWith("merge_pr:")) return;

    const thread = event.thread;
    const state = (await thread.state) as CodingAgentThreadState | null;

    const parsed = parseMergeActionId(event.actionId);
    if (!parsed) {
      await thread.post("Invalid merge action.");
      return;
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      await thread.post("Missing GITHUB_TOKEN — cannot merge PRs.");
      return;
    }

    const pr = state?.prs?.find(
      p => p.repo === parsed.repo && p.number === parsed.number,
    );

    if (!pr) {
      await thread.post(`PR ${parsed.repo}#${parsed.number} not found in this thread.`);
      return;
    }

    const result = await mergeGithubPR(pr.repo, pr.number, token);

    if (result.ok === false) {
      const { message } = result;
      await thread.post(`❌ ${pr.repo}#${pr.number} failed to merge: ${message}`);
      return;
    }

    // Remove merged PR from state
    const remainingPrs = state!.prs!.filter(
      p => !(p.repo === pr.repo && p.number === pr.number),
    );
    const allMerged = remainingPrs.length === 0;

    await thread.setState({
      status: allMerged ? "merged" : state!.status,
      prs: remainingPrs,
    });

    if (allMerged) {
      await handleMergeSuccess(state!);
    }

    await thread.post(`✅ ${pr.repo}#${pr.number} merged.`);

    // Offer "Merge test to main" when the PR targeted the test branch
    if (pr.baseBranch === "test") {
      const card = buildMergeTestToMainCard(pr.repo);
      await thread.post({ card });
    }
  });
}
