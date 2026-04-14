import { getThread } from "@/lib/agents/getThread";
import { buildPRCard } from "./buildPRCard";
import { setCodingAgentPRState } from "./prState";
import type { CodingAgentCallbackBody } from "./validateCodingAgentCallback";
import type { CodingAgentThreadState } from "./types";

/**
 * Handle PRCreated.
 *
 * @param threadId - Value for threadId.
 * @param body - Request payload.
 * @returns - Computed result.
 */
export async function handlePRCreated(threadId: string, body: CodingAgentCallbackBody) {
  const thread = getThread<CodingAgentThreadState>(threadId);
  const prs = body.prs ?? [];
  const card = buildPRCard("PRs Created", prs);

  await thread.post({ card });

  await thread.setState({
    status: "pr_created",
    branch: body.branch,
    snapshotId: body.snapshotId,
    prs,
  });

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
