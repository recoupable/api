import { getThread } from "@/lib/agents/getThread";
import { buildPRCard } from "./buildPRCard";
import { setCodingAgentPRState } from "./prState";
import type { CodingAgentCallbackBody } from "./validateCodingAgentCallback";
import type { CodingAgentThreadState } from "./types";

/**
 * Handles the pr_created callback status.
 * Writes to both thread state and shared PR state key.
 *
 * @param threadId
 * @param body
 */
export async function handlePRCreated(threadId: string, body: CodingAgentCallbackBody) {
  const thread = getThread<CodingAgentThreadState>(threadId);
  const prs = body.prs ?? [];
  const card = buildPRCard("PRs Created", prs);

  await thread.post({ card });

  await thread.setState({
    status: "pr_created",
    branch: body.branch,
    prs,
  });

  if (body.branch && prs.length) {
    await setCodingAgentPRState(prs[0].repo, body.branch, {
      status: "pr_created",
      branch: body.branch,
      repo: prs[0].repo,
      prs,
    });
  }
}
