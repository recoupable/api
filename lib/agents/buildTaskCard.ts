import { Card, CardText, Actions, LinkButton } from "chat";
import { getFrontendBaseUrl } from "@/lib/composio/getFrontendBaseUrl";

/**
 * Builds a Card with a message and a View Task button.
 *
 * @param title - Card title (e.g. "Task Started", "Updating PRs")
 * @param message - Body text
 * @param runId - Trigger.dev run ID for the View Task link
 * @returns A Card object with the message and a "View Task" link button
 */
export function buildTaskCard(title: string, message: string, runId: string) {
  return Card({
    title,
    children: [
      CardText(message),
      Actions([LinkButton({ url: `${getFrontendBaseUrl()}/tasks/${runId}`, label: "View Task" })]),
    ],
  });
}
