import { getThread } from "./getThread";
import { buildPRCard } from "./buildPRCard";
import { setCodingAgentPRState } from "./prState";
import { parseGitHubThreadId } from "./parseGitHubThreadId";
import { postGitHubComment } from "./postGitHubComment";
import type { CodingAgentCallbackBody } from "./validateCodingAgentCallback";

/**
 * Handles the pr_created callback status.
 * Writes to both thread state and shared PR state key.
 *
 * @param threadId
 * @param body
 */
export async function handlePRCreated(threadId: string, body: CodingAgentCallbackBody) {
  const github = parseGitHubThreadId(threadId);
  const prs = body.prs ?? [];

  if (github) {
    const prLinks = prs.map((pr) => `- [${pr.repo}#${pr.number}](${pr.url})`).join("\n");
    await postGitHubComment(
      github.repo,
      github.prNumber,
      `PRs Created:\n${prLinks}`,
    );
  } else {
    const thread = getThread(threadId);
    const card = buildPRCard("PRs Created", prs);
    await thread.post({ card });
    await thread.setState({
      status: "pr_created",
      branch: body.branch,
      snapshotId: body.snapshotId,
      prs,
    });
  }

  if (body.branch && prs.length) {
    await setCodingAgentPRState(prs[0].repo, body.branch, {
      status: "pr_created",
      snapshotId: body.snapshotId,
      branch: body.branch,
      repo: prs[0].repo,
      prs,
    });
  }
}
