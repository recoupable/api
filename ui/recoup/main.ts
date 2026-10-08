import { App, applyDocumentTheme, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import { OpenAIExtensions } from "@openai/mcp-extensions/app";
import features from "./features.json";
import { buildWorkflowPrompt } from "./buildWorkflowPrompt";

const app = new App({ name: "Recoup", version: "1.0.0" });
const extensions = new OpenAIExtensions(app);
const root = document.getElementById("root")!;
const starters = ["calendar", "cover", "play", "lyrics", "wave", "radar"];
let connected = false;
let all = false;
let paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
let query = "";
let selected: (typeof features)[number] | undefined;
let returnFocus: HTMLElement | null = null;
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
root.innerHTML = `<header><a class="brand" href="#" aria-label="Recoup home"><img src="__WORDMARK__" alt="Recoup"></a><span>Explore</span><button id="motion" type="button"></button></header><main><div class="intro"><p class="eyebrow">YOUR MUSIC. MORE POSSIBILITIES.</p><h1>What do you want to make?</h1><p>Pick something that catches your eye.</p></div><div class="toolbar"><label class="search"><span class="sr-only">Search experiences</span><input id="search" type="search" placeholder="Try video, fans, catalog…"></label></div><section id="cards" aria-label="Music experiences"></section><button id="more" class="more">See all experiences</button><p id="connection" class="connection" role="status">Connecting to your conversation…</p></main><dialog id="detail"><button class="close" aria-label="Close experience">×</button><div id="detail-content"></div></dialog>`;
const dialog = document.querySelector<HTMLDialogElement>("#detail")!;
const cards = document.querySelector<HTMLElement>("#cards")!;
const status = document.querySelector<HTMLElement>("#connection")!;
const observer = new IntersectionObserver(
  entries =>
    entries.forEach(entry => {
      const video = entry.target as HTMLVideoElement;
      if (entry.isIntersecting && !paused && !document.hidden && !dialog.open)
        void video.play().catch(() => {});
      else video.pause();
    }),
  { threshold: 0.15 },
);
function renderCards() {
  observer.disconnect();
  const visible = query || all ? features : starters.map(id => features.find(f => f.id === id)!);
  const filtered = visible.filter(f =>
    `${f.title} ${f.description} ${f.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  cards.innerHTML =
    filtered
      .map(
        f =>
          `<button class="card" data-id="${f.id}">${f.video ? `<video muted loop playsinline preload="metadata" aria-hidden="true" src="${f.video}"></video>` : `<div aria-hidden="true" class="art art-${f.category.toLowerCase()}"><span>${escape(f.category)}</span><strong>${escape(f.title)}</strong></div>`}<h2>${escape(f.title)}</h2><p>${escape(f.description)}</p><span class="try">Explore →</span></button>`,
      )
      .join("") || "<p>No matches. Try “video” or “release”.</p>";
  cards.querySelectorAll("video").forEach(video => {
    video.muted = true;
    observer.observe(video);
  });
  document.querySelector<HTMLElement>("#more")!.hidden = all || !!query;
}
function syncMotion() {
  document.querySelector("#motion")!.textContent = paused ? "Play previews" : "Pause previews";
  document.querySelector("#motion")!.setAttribute("aria-pressed", String(paused));
  document.querySelectorAll("video").forEach(video => {
    video.pause();
    observer.unobserve(video);
    observer.observe(video);
  });
}
function openFeature(id: string) {
  selected = features.find(f => f.id === id);
  if (!selected) return;
  returnFocus = document.activeElement as HTMLElement;
  document.querySelector("#detail-content")!.innerHTML =
    `<p class="eyebrow">${escape(selected.category)}</p><h2>${escape(selected.title)}</h2><p>${escape(selected.description)}</p><p class="outputs">${selected.outputs.map(escape).join(" · ")}</p><form><label for="brief">What are we working on?</label><textarea id="brief" required maxlength="4000" rows="5" placeholder="${escape(selected.inputs.join(", "))}. Add a link or describe your idea."></textarea><p class="hint">Start with what you have. Attach audio or files in the conversation.</p><button class="primary" type="submit">Continue in chat ↗</button><p id="feedback" role="status"></p><button id="copy" type="button" hidden>Copy brief</button></form>`;
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
      if (!connected)
        throw new Error("Open Recoup inside your connected plugin to continue in chat.");
      const params = { role: "user" as const, content: [{ type: "text" as const, text: prompt }] };
      const result = extensions.message
        ? await extensions.message.send(params)
        : await app.sendMessage(params);
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
}
cards.onclick = event => {
  const card = (event.target as HTMLElement).closest<HTMLElement>("[data-id]");
  if (card) openFeature(card.dataset.id!);
};
document.querySelector("#search")!.addEventListener("input", event => {
  query = (event.target as HTMLInputElement).value;
  renderCards();
});
document.querySelector("#more")!.addEventListener("click", () => {
  all = true;
  renderCards();
});
document.querySelector("#motion")!.addEventListener("click", () => {
  paused = !paused;
  syncMotion();
});
dialog.querySelector(".close")!.addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  syncMotion();
  returnFocus?.focus();
});
document.addEventListener("visibilitychange", syncMotion);
function applyContext() {
  const context = app.getHostContext();
  if (context?.theme) applyDocumentTheme(context.theme);
  if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
}
app.ontoolresult = () => {
  status.textContent = "Choose an experience to start with your music.";
};
app.onhostcontextchanged = applyContext;
renderCards();
syncMotion();
if (window.parent === window) {
  status.textContent = "Browser preview · Open the connected Recoup plugin to continue in chat.";
} else {
  const timer = setTimeout(() => {
    if (!connected)
      status.textContent = "Still connecting. You can explore while the host connects.";
  }, 8000);
  void app
    .connect()
    .then(() => {
      connected = true;
      clearTimeout(timer);
      applyContext();
      status.textContent = "Connected to your conversation";
    })
    .catch(() => {
      clearTimeout(timer);
      status.textContent = "Could not connect. Reopen Recoup in your host.";
    });
}
