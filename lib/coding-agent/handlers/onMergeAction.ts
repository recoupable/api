import type { CodingAgentBot } from "../bot";
import { deleteCodingAgentPRState } from "../prState";
import type { CodingAgentThreadState } from "../types";

/**
 * Registers the "Merge All PRs" button action handler on the bot.
 * Squash-merges each PR via the GitHub API.
 *
 * @param bot
 */
export function registerOnMergeAction(bot: CodingAgentBot) {
  bot.onAction("merge_all_prs", async event => {
    const thread = event.thread;
    const state = (await thread.state) as CodingAgentThreadState | null;

    if (!state?.prs?.length) {
      await thread.post("No PRs to merge.");
      return;
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      await thread.post("Missing GITHUB_TOKEN — cannot merge PRs.");
      return;
    }

    const results: string[] = [];

    for (const pr of state.prs) {
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
        results.push(`${pr.repo}#${pr.number} merged`);
      } else {
        const errorBody = await response.text();
        console.error(`[coding-agent] merge failed for ${pr.repo}#${pr.number}: ${response.status} ${errorBody}`);
        const error = JSON.parse(errorBody);
        results.push(`${pr.repo}#${pr.number} failed: ${error.message}`);
      }
    }

    await thread.setState({ status: "merged" });
    if (state.branch && state.prs?.[0]?.repo) {
      await deleteCodingAgentPRState(state.prs[0].repo, state.branch);
    }
    await thread.post(`Merge results:\n${results.map(r => `- ${r}`).join("\n")}`);
  });
}
