import { getThread } from "./getThread";
import { buildPRCard } from "./buildPRCard";
import type { CodingAgentCallbackBody } from "./validateCodingAgentCallback";

/**
 * Handles the pr_created callback status.
 *
 * @param threadId
 * @param body
 */
export async function handlePRCreated(threadId: string, body: CodingAgentCallbackBody) {
  const thread = getThread(threadId);
  const card = buildPRCard("PRs Created", body.prs ?? []);

  await thread.post({ card });

  await thread.setState({
    status: "pr_created",
    branch: body.branch,
    snapshotId: body.snapshotId,
    prs: body.prs,
  });
}
