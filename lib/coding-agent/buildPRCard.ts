import { Card, CardText, Actions, Button, LinkButton } from "chat";
import type { CodingAgentPR } from "./types";

/**
 * Build PRCard.
 *
 * @param title - Value for title.
 * @param prs - Value for prs.
 * @returns - Computed result.
 */
export function buildPRCard(title: string, prs: CodingAgentPR[]) {
  return Card({
    title,
    children: [
      CardText(
        `${prs.map(pr => `- ${pr.repo}#${pr.number} → \`${pr.baseBranch}\``).join("\n")}\n\nReply in this thread to give feedback.`,
      ),
      Actions([
        ...prs.flatMap(pr => [
          LinkButton({ url: pr.url, label: `Review ${pr.repo}#${pr.number}` }),
          Button({
            id: `merge_pr:${pr.repo}#${pr.number}`,
            label: `Merge ${pr.repo}#${pr.number}`,
            style: "primary",
          }),
        ]),
      ]),
    ],
  });
}
