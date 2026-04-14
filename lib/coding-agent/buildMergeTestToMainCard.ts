import { Card, CardText, Actions, Button } from "chat";

/**
 * Build Merge Test To Main Card.
 *
 * @param repo - Parameter.
 * @returns - Result.
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
