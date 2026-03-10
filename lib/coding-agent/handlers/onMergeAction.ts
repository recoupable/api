import type { CodingAgentBot } from "../bot";
import type { CodingAgentThreadState } from "../types";
import { handleMergeSuccess } from "../handleMergeSuccess";
import { parseMergeActionId } from "../parseMergeActionId";

/**
 * Registers individual per-PR merge button action handlers on the bot.
 * Each button has an ID like "merge_pr:<repo>#<number>" and squash-merges
 * that single PR via the GitHub API.
 *
 * Uses a prefix pattern so a single handler covers all merge_pr:* actions.
 *
 * @param bot
 */
export function registerOnMergeAction(bot: CodingAgentBot) {
  bot.onAction("merge_pr:", async event => {
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

    const [owner, repo] = pr.repo.split("/");
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/merge`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ merge_method: "squash" }),
      },
    );

    if (response.ok) {
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
    } else {
      const errorBody = await response.text();
      console.error(
        `[coding-agent] merge failed for ${pr.repo}#${pr.number}: ${response.status} ${errorBody}`,
      );
      const error = JSON.parse(errorBody);
      await thread.post(`❌ ${pr.repo}#${pr.number} failed to merge: ${error.message}`);
    }
  });
}
