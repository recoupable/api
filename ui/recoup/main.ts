import features from "./features";
import { escapeHtml } from "./escapeHtml";
import { createHostBridge } from "./createHostBridge";
import { createFeatureDialog } from "./createFeatureDialog";
import { filterWorkflows } from "./filterWorkflows";

const root = document.getElementById("root")!;
const categories = ["Featured", "All", ...new Set(features.map(f => f.category))];
let category = "Featured";
let query = "";
let previewsPaused = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
root.innerHTML = `<header><a class="brand" href="#" aria-label="Recoup home"><img src="__WORDMARK__" alt="Recoup"></a><span class="header-label">YOUR MUSIC. YOUR NEXT MOVE.</span><button id="motion" aria-pressed="false">Pause previews</button></header><main><section class="hero" aria-labelledby="hero-title"><div><p class="eyebrow">POWERED BY AI AGENTS</p><h1 id="hero-title">Your record label.<br>Inside your chat.</h1><p class="hero-description">Create something worth playing.<br>Find the fans who’ll play it.</p></div><div class="how-it-works"><p class="eyebrow">FROM IDEA TO NEXT MOVE</p><ol><li><span>01</span>Pick a workflow</li><li><span>02</span>Bring your music or an idea</li><li><span>03</span>Continue in your conversation</li></ol></div></section><section aria-labelledby="library-title"><div class="toolbar"><div><p class="eyebrow">THE WORKFLOW LIBRARY</p><h2 id="library-title">Put your agents to work.</h2></div><label class="search"><span class="sr-only">Search workflows</span><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Search videos, releases, fans…"></label></div><div class="filter-row"><nav id="filters" aria-label="Workflow categories">${categories.map(c => `<button data-category="${c}" aria-pressed="${c === category}">${c}</button>`).join("")}</nav><p id="result-count" role="status" aria-live="polite"></p></div><section id="cards" aria-label="Music workflows"></section><button id="more" class="more">Explore all ${features.length} workflows <span aria-hidden="true">↗</span></button></section><footer><p>Pick a direction. Your agent helps with the next step.</p><p id="connection" class="connection" role="status">Connecting to your conversation…</p></footer></main><dialog id="detail" aria-labelledby="detail-title"><button class="close" aria-label="Close workflow">×</button><div id="detail-content"></div></dialog>`;
const dialog = document.querySelector<HTMLDialogElement>("#detail")!;
const cards = document.querySelector<HTMLElement>("#cards")!;
const status = document.querySelector<HTMLElement>("#connection")!;
const search = document.querySelector<HTMLInputElement>("#search")!;
const more = document.querySelector<HTMLButtonElement>("#more")!;
const motion = document.querySelector<HTMLButtonElement>("#motion")!;
const observer = new IntersectionObserver(
  entries =>
    entries.forEach(entry => {
      const video = entry.target as HTMLVideoElement;
      if (
        entry.isIntersecting &&
        !reducedMotion.matches &&
        !previewsPaused &&
        !document.hidden &&
        !dialog.open
      )
        void video.play().catch(() => {});
      else video.pause();
    }),
  { threshold: 0.15 },
);
function renderCards() {
  cards.querySelectorAll("video").forEach(video => video.pause());
  observer.disconnect();
  const filtered = filterWorkflows(query, category);
  cards.innerHTML =
    filtered
      .map(
        f =>
          `<button class="card" data-id="${f.id}" aria-haspopup="dialog" aria-label="${escapeHtml(f.title)}"><span class="media"><span aria-hidden="true" class="art art-${f.category.toLowerCase()}"><span>${escapeHtml(f.category)}</span><strong>${escapeHtml(f.title)}</strong></span>${f.video ? `<video muted loop playsinline preload="metadata" aria-hidden="true" src="${escapeHtml(f.video)}"></video>` : ""}<span class="preview-label" aria-hidden="true">EXAMPLE PREVIEW</span><span class="card-arrow" aria-hidden="true">↗</span></span><span class="card-category">${escapeHtml(f.category)}</span><span class="card-title">${escapeHtml(f.title)}</span><span class="card-description">${escapeHtml(f.description)}</span></button>`,
      )
      .join("") ||
    `<div class="empty"><p class="eyebrow">LET’S FIND YOUR NEXT MOVE</p><h3>No workflows found</h3><p>Try “video”, “release”, or browse the full library.</p><button id="reset" class="more">Clear filters</button></div>`;
  cards.querySelectorAll("video").forEach(video => {
    video.muted = true;
    video.addEventListener("loadeddata", () => video.classList.add("loaded"));
    video.addEventListener("error", () => {
      video.hidden = true;
      observer.unobserve(video);
    });
    observer.observe(video);
  });
  document.querySelector<HTMLElement>("#result-count")!.textContent =
    `${filtered.length} workflow${filtered.length === 1 ? "" : "s"}`;
  document
    .querySelectorAll<HTMLButtonElement>("[data-category]")
    .forEach(button =>
      button.setAttribute("aria-pressed", String(button.dataset.category === category)),
    );
  more.hidden = category !== "Featured" || !!query.trim();
}
function syncMotion() {
  motion.disabled = reducedMotion.matches;
  motion.textContent = reducedMotion.matches
    ? "Reduced motion on"
    : previewsPaused
      ? "Play previews"
      : "Pause previews";
  motion.setAttribute("aria-pressed", String(previewsPaused || reducedMotion.matches));
  cards.querySelectorAll("video").forEach(video => {
    video.pause();
    observer.unobserve(video);
    observer.observe(video);
  });
}
const openFeature = createFeatureDialog(dialog, createHostBridge(status), syncMotion);
cards.onclick = event => {
  const target = event.target as HTMLElement;
  const card = target.closest<HTMLElement>("[data-id]");
  if (card) openFeature(card.dataset.id!);
  else if (target.closest("#reset")) {
    query = search.value = "";
    category = "All";
    renderCards();
    search.focus();
  }
};
search.addEventListener("input", () => {
  query = search.value;
  renderCards();
});
document.querySelector("#filters")!.addEventListener("click", event => {
  const button = (event.target as HTMLElement).closest<HTMLElement>("[data-category]");
  if (button) {
    category = button.dataset.category!;
    renderCards();
  }
});
more.addEventListener("click", () => {
  category = "All";
  renderCards();
  document.querySelector<HTMLButtonElement>('[data-category="All"]')!.focus();
});
document.querySelector(".brand")!.addEventListener("click", event => {
  event.preventDefault();
  category = "Featured";
  query = search.value = "";
  renderCards();
  window.scrollTo({ top: 0 });
});
motion.addEventListener("click", () => {
  previewsPaused = !previewsPaused;
  syncMotion();
});
reducedMotion.addEventListener("change", syncMotion);
document.addEventListener("visibilitychange", syncMotion);
renderCards();
syncMotion();
