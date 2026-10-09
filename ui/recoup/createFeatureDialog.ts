import features from "./features";
import { escapeHtml } from "./escapeHtml";
import { buildWorkflowPrompt } from "./buildWorkflowPrompt";

export function createFeatureDialog(
  dialog: HTMLDialogElement,
  send: (prompt: string) => Promise<{ isError?: boolean }>,
  syncMotion: () => void,
) {
  // Keep drafts only for this page session; do not store private briefs on disk.
  const drafts = new Map<
    string,
    {
      brief: string;
      pending: boolean;
      sent: boolean;
      feedback: string;
      prompt: string;
      failed: boolean;
    }
  >();
  let returnFocus: HTMLElement | null = null;
  let activeId = "";
  let refreshActive = () => {};
  dialog.querySelector(".close")!.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const { left, right, top, bottom } = dialog.getBoundingClientRect();
    if (
      event.clientX < left ||
      event.clientX > right ||
      event.clientY < top ||
      event.clientY > bottom
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => {
    syncMotion();
    returnFocus?.focus();
  });
  return function openFeature(id: string) {
    const selected = features.find(f => f.id === id);
    if (!selected) return;
    activeId = id;
    const state = drafts.get(id) ?? {
      brief: "",
      pending: false,
      sent: false,
      feedback: "",
      prompt: "",
      failed: false,
    };
    drafts.set(id, state);
    returnFocus = document.activeElement as HTMLElement;
    dialog.querySelector("#detail-content")!.innerHTML =
      `<p class="eyebrow">${escapeHtml(selected.category)} WORKFLOW</p><h2 id="detail-title">${escapeHtml(selected.title)}</h2><p>${escapeHtml(selected.description)}</p><p class="eyebrow">WHAT WE’LL WORK TOWARD</p><ul class="output-list">${selected.outputs.map(output => `<li>${escapeHtml(output)}</li>`).join("")}</ul><form><label for="brief">What are we working on?</label><textarea id="brief" required maxlength="4000" rows="5" aria-describedby="brief-hint brief-count" placeholder="${escapeHtml(selected.inputs.join(", "))}. Add a link or describe your idea."></textarea><div class="brief-meta"><p id="brief-hint" class="hint">Start with what you have. Attach audio or files in the conversation.<br>Your brief stays here until you close or reload Recoup.</p><p id="brief-count" class="hint"></p></div><button class="primary" type="submit">Continue in chat ↗</button><p id="feedback" role="status" aria-live="polite"></p><button id="copy" type="button" hidden>Copy workflow brief</button><button id="another" type="button" class="more" hidden>Start another brief</button><button id="done" type="button" class="more" hidden>Back to workflows</button></form>`;
    const form = dialog.querySelector("form")!;
    const textarea = form.querySelector("textarea")!;
    const button = form.querySelector<HTMLButtonElement>(".primary")!;
    const feedback = form.querySelector<HTMLElement>("#feedback")!;
    const copy = form.querySelector<HTMLButtonElement>("#copy")!;
    textarea.value = state.brief;
    refreshActive = () => {
      button.disabled = state.pending || state.sent;
      textarea.readOnly = state.pending || state.sent;
      button.textContent = state.pending
        ? "Sending brief…"
        : state.sent
          ? "Brief sent ✓"
          : "Continue in chat ↗";
      feedback.textContent = state.feedback;
      copy.hidden = !state.failed;
      form.querySelector<HTMLElement>("#done")!.hidden = !state.sent;
      form.querySelector<HTMLElement>("#another")!.hidden = !state.sent;
      form.querySelector<HTMLElement>("#brief-count")!.textContent =
        `${state.brief.length.toLocaleString()} / 4,000`;
    };
    textarea.addEventListener("input", () => {
      state.brief = textarea.value;
      state.failed = false;
      state.feedback = "";
      form.querySelector("#copyable")?.remove();
      refreshActive();
    });
    form.querySelector("#done")!.addEventListener("click", () => dialog.close());
    form.querySelector("#another")!.addEventListener("click", () => {
      Object.assign(state, {
        brief: "",
        pending: false,
        sent: false,
        feedback: "",
        prompt: "",
        failed: false,
      });
      textarea.value = "";
      refreshActive();
      textarea.focus();
    });
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(state.prompt);
        if (!form.isConnected) return;
        feedback.textContent = "Copied. Paste it into your conversation.";
      } catch {
        if (!form.isConnected) return;
        feedback.textContent = "Select and copy the workflow brief below.";
        let copyable = form.querySelector<HTMLTextAreaElement>("#copyable");
        if (!copyable) {
          copyable = document.createElement("textarea");
          copyable.id = "copyable";
          copyable.readOnly = true;
          copyable.setAttribute("aria-label", "Copyable workflow request");
          copy.after(copyable);
        }
        copyable.value = state.prompt;
        copyable.select();
      }
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (state.pending || state.sent) return;
      try {
        state.prompt = buildWorkflowPrompt(selected, textarea.value);
      } catch (error) {
        state.feedback = error instanceof Error ? error.message : "Add a brief to continue.";
        refreshActive();
        textarea.focus();
        return;
      }
      state.pending = true;
      state.failed = false;
      state.feedback = "Sending your brief to the conversation…";
      refreshActive();
      try {
        const result = await send(state.prompt);
        if (result.isError)
          throw new Error("The conversation could not accept this brief. Try again or copy it.");
        state.sent = true;
        state.feedback = "Brief sent. Continue in your conversation to work with your agent.";
      } catch (error) {
        state.failed = true;
        state.feedback =
          error instanceof Error ? error.message : "Unable to send. Your brief is still here.";
      } finally {
        state.pending = false;
        if (activeId === id) refreshActive();
      }
    };
    refreshActive();
    dialog.showModal();
    syncMotion();
    if (state.pending || state.sent) dialog.querySelector<HTMLButtonElement>(".close")!.focus();
    else textarea.focus();
  };
}
