import { Card, CardText, Actions, Button, LinkButton } from "chat";
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

  const card = Card({
    title: "PRs Created",
    children: [
      CardText(`${prLinks}\n\nReply in this thread to give feedback.`),
      Actions([
        ...((body.prs ?? []).map(pr =>
          LinkButton({ url: pr.url, label: `Review ${pr.repo}#${pr.number}` }),
        )),
        Button({ id: "merge_all_prs", label: "Merge All PRs", style: "primary" }),
      ]),
    ],
  });

  await thread.post({ card });

  await thread.setState({
    status: "pr_created",
    branch: body.branch,
    snapshotId: body.snapshotId,
    prs: body.prs,
  });
}
