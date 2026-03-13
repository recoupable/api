import { Card, CardText, Actions, Button, LinkButton } from "chat";
import type { CodingAgentPR } from "./types";

/**
 * Builds a Card with PR review links and a Merge All PRs button.
 *
 * @param title - Card title (e.g. "PRs Created", "PRs Updated")
 * @param prs - Array of PRs to build review links for
 */
export function buildPRCard(title: string, prs: CodingAgentPR[]) {
  return Card({
    title,
    children: [
      CardText(
        `${prs.map(pr => `- ${pr.repo}#${pr.number} → \`${pr.baseBranch}\``).join("\n")}\n\nReply in this thread to give feedback.`,
      ),
      Actions([
        ...prs.map(pr => LinkButton({ url: pr.url, label: `Review ${pr.repo}#${pr.number}` })),
        Button({ id: "merge_all_prs", label: "Merge All PRs", style: "primary" }),
      ]),
    ],
  });
}
