import features from "./features";
import { escapeHtml } from "./escapeHtml";
import { buildWorkflowPrompt } from "./buildWorkflowPrompt";

export function createFeatureDialog(
  dialog: HTMLDialogElement,
  send: (prompt: string) => Promise<{ isError?: boolean }>,
  syncMotion: () => void,
) {
  let returnFocus: HTMLElement | null = null;
  dialog.querySelector(".close")!.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    syncMotion();
    returnFocus?.focus();
  });
  return function openFeature(id: string) {
    const selected = features.find(f => f.id === id);
    if (!selected) return;
    returnFocus = document.activeElement as HTMLElement;
    document.querySelector("#detail-content")!.innerHTML =
      `<p class="eyebrow">${escapeHtml(selected.category)}</p><h2 id="detail-title">${escapeHtml(selected.title)}</h2><p>${escapeHtml(selected.description)}</p><p class="outputs">${selected.outputs.map(escapeHtml).join(" · ")}</p><form><label for="brief">What are we working on?</label><textarea id="brief" required maxlength="4000" rows="5" placeholder="${escapeHtml(selected.inputs.join(", "))}. Add a link or describe your idea."></textarea><p class="hint">Start with what you have. Attach audio or files in the conversation.</p><button class="primary" type="submit">Continue in chat ↗</button><p id="feedback" role="status"></p><button id="copy" type="button" hidden>Copy brief</button></form>`;
    dialog.showModal();
    syncMotion();
    dialog.querySelector("textarea")!.focus();
    dialog.querySelector("form")!.onsubmit = async event => {
      event.preventDefault();
      const brief = dialog.querySelector("textarea")!.value;
      const feedback = dialog.querySelector<HTMLElement>("#feedback")!;
      const button = dialog.querySelector<HTMLButtonElement>(".primary")!;
      let prompt: string;
      try {
        prompt = buildWorkflowPrompt(selected!, brief);
      } catch (error) {
        feedback.textContent = error instanceof Error ? error.message : "Add a brief to continue.";
        dialog.querySelector("textarea")!.focus();
        return;
      }
      button.disabled = true;
      feedback.textContent = "Sending your brief…";
      try {
        const result = await send(prompt);
        if (result.isError)
          throw new Error("The conversation could not accept this brief. Try again or copy it.");
        feedback.textContent = "Sent. Continue in your conversation.";
        button.textContent = "Brief sent ✓";
      } catch (error) {
        feedback.textContent =
          error instanceof Error ? error.message : "Unable to send. Your brief is still here.";
        button.disabled = false;
        const copy = dialog.querySelector<HTMLButtonElement>("#copy")!;
        copy.hidden = false;
        copy.onclick = async () => {
          try {
            await navigator.clipboard.writeText(prompt);
            feedback.textContent = "Copied. Paste it into your conversation.";
          } catch {
            feedback.textContent = "Select and copy the brief below.";
            let copyable = dialog.querySelector<HTMLTextAreaElement>("#copyable");
            if (!copyable) {
              copyable = document.createElement("textarea");
              copyable.id = "copyable";
              copyable.readOnly = true;
              copyable.setAttribute("aria-label", "Copyable workflow request");
              copy.after(copyable);
            }
            copyable.value = prompt;
            copyable.select();
          }
        };
      }
    };
  };
}
