import type { CodingAgentBot } from "../bot";
import { deleteCodingAgentPRState } from "../prState";
import type { CodingAgentThreadState } from "../types";
import { upsertAccountSnapshot } from "@/lib/supabase/account_snapshots/upsertAccountSnapshot";
import { RECOUP_ORG_ID } from "@/lib/const";

/**
 * Registers the "Merge All PRs" button action handler on the bot.
 * Squash-merges each PR via the GitHub API, then persists the latest
 * snapshot via PATCH /api/sandboxes so the coding-agent account stays
 * up-to-date.
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

    const allMerged = results.every(r => r.endsWith("merged"));

    // On failure, revert to pr_created so handleFeedback still accepts replies
    await thread.setState({ status: allMerged ? "merged" : "pr_created" });
    if (allMerged && state.branch && state.prs?.[0]?.repo) {
      await deleteCodingAgentPRState(state.prs[0].repo, state.branch);
    }

    // Persist the latest snapshot only when every PR merged successfully
    // so new sandboxes start from the post-merge state.
    if (allMerged && state.snapshotId) {
      const snapshotResult = await upsertAccountSnapshot({
        account_id: RECOUP_ORG_ID,
        snapshot_id: state.snapshotId,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (snapshotResult.error) {
        console.error(
          `[coding-agent] failed to persist snapshot for ${RECOUP_ORG_ID}:`,
          snapshotResult.error,
        );
      }
    }

    await thread.post(`Merge results:\n${results.map(r => `- ${r}`).join("\n")}`);
  });
}
