import { Card, CardText, Actions, LinkButton } from "chat";

/**
 * Builds a Card with a message and a View Task button.
 *
 * @param title - Card title (e.g. "Task Started", "Updating PRs")
 * @param message - Body text
 * @param runId - Trigger.dev run ID for the View Task link
 * @returns A Card component with the message text and a link to the Trigger.dev task run
 */
export function buildTaskCard(title: string, message: string, runId: string) {
  return Card({
    title,
    children: [
      CardText(message),
      Actions([
        LinkButton({ url: `https://chat.recoupable.com/tasks/${runId}`, label: "View Task" }),
      ]),
    ],
  });
}
