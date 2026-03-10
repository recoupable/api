import { Card, CardText, Actions, Button } from "chat";

/**
 * Builds a Card with a "Merge test to main" button for a specific repo.
 *
 * @param repo - Full repo identifier (e.g. "recoupable/chat")
 */
export function buildMergeTestToMainCard(repo: string) {
  return Card({
    title: "Merge to Main",
    children: [
      CardText(`Ready to promote \`test\` → \`main\` for ${repo}.`),
      Actions([
        Button({
          id: `merge_test_to_main:${repo}`,
          label: `Merge test → main (${repo})`,
          style: "primary",
        }),
      ]),
    ],
  });
}
