import features from "./features";
import { buildWorkflowPrompt } from "./buildWorkflowPrompt";

/** Start the conversation directly; the host receives the selected workflow. */
export function startExperience(
  send: (prompt: string) => Promise<{ isError?: boolean }>,
  status: HTMLElement,
  cards: HTMLElement,
) {
  let pending = false;
  return async (id: string) => {
    const feature = features.find(item => item.id === id);
    if (!feature || pending) return;
    pending = true;
    cards.setAttribute("aria-busy", "true");
    status.classList.add("handoff-active");
    status.textContent = `Starting ${feature.title} in chat…`;
    try {
      const result = await send(buildWorkflowPrompt(feature));
      if (result.isError) throw new Error("The conversation could not accept the request.");
      status.textContent = `${feature.title} sent. Continue in your conversation.`;
    } catch (error) {
      status.textContent = `${error instanceof Error ? error.message : "Could not start the experience."} Click the card to try again.`;
    } finally {
      pending = false;
      cards.removeAttribute("aria-busy");
    }
  };
}
