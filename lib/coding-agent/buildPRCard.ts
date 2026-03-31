import { Card, CardText, Actions, Button, LinkButton } from "chat";
import type { CodingAgentPR } from "./types";

/**
 * Builds a Card with PR review links and individual Merge buttons per PR.
 *
 * @param title - Card title (e.g. "PRs Created", "PRs Updated")
 * @param prs - Array of PRs to build review links for
 * @returns A Card component listing each PR with a review link and merge button
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
