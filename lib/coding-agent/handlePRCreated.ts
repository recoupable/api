import { getThread } from "./getThread";
import type { CodingAgentCallbackBody } from "./validateCodingAgentCallback";

/**
 * Handles the pr_created callback status.
 *
 * @param threadId
 * @param body
 */
export async function handlePRCreated(threadId: string, body: CodingAgentCallbackBody) {
  const thread = getThread(threadId);
  const prLinks = (body.prs ?? [])
    .map(pr => `- [${pr.repo}#${pr.number}](${pr.url}) → \`${pr.baseBranch}\``)
    .join("\n");

  await thread.post(
    `PRs created:\n${prLinks}\n\nReply in this thread to give feedback, or click Merge when ready.`,
  );

  await thread.setState({
    status: "pr_created",
    branch: body.branch,
    snapshotId: body.snapshotId,
    prs: body.prs,
  });
}
