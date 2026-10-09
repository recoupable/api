import features from "./features";
import { escapeHtml } from "./escapeHtml";
import { createHostBridge } from "./createHostBridge";
import { createFeatureDialog } from "./createFeatureDialog";

const root = document.getElementById("root")!;
const starters = ["calendar", "cover", "play", "lyrics", "wave", "radar"];
let all = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let query = "";
root.innerHTML = `<header><a class="brand" href="#" aria-label="Recoup home"><img src="__WORDMARK__" alt="Recoup"></a></header><main><section class="hero" aria-labelledby="hero-title"><p class="eyebrow">POWERED BY AI AGENTS</p><h1 id="hero-title">A record label.<br>Inside ChatGPT.</h1><p class="hero-description">An AI team for your music—creating content, planning releases,<br class="desktop-break"> finding fans, and working your catalog.</p></section><div id="experiences" class="toolbar"><h2>Put your team to work.</h2><label class="search"><span class="sr-only">Search experiences</span><input id="search" type="search" placeholder="Search videos, releases, fans…"></label></div><section id="cards" aria-label="Music experiences"></section><button id="more" class="more">See all experiences</button><p id="connection" class="connection" role="status">Connecting to your conversation…</p></main><dialog id="detail" aria-labelledby="detail-title"><button class="close" aria-label="Close experience">×</button><div id="detail-content"></div></dialog>`;
const dialog = document.querySelector<HTMLDialogElement>("#detail")!;
const cards = document.querySelector<HTMLElement>("#cards")!;
const status = document.querySelector<HTMLElement>("#connection")!;
const observer = new IntersectionObserver(
  entries =>
    entries.forEach(entry => {
      const video = entry.target as HTMLVideoElement;
      if (entry.isIntersecting && !reducedMotion.matches && !document.hidden && !dialog.open)
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
          `<button class="card" data-id="${f.id}">${f.video ? `<video muted loop playsinline preload="metadata" aria-hidden="true" src="${f.video}"></video>` : `<span aria-hidden="true" class="art art-${f.category.toLowerCase()}"><span>${escapeHtml(f.category)}</span><strong>${escapeHtml(f.title)}</strong></span>`}<span class="card-title">${escapeHtml(f.title)}</span><span class="card-description">${escapeHtml(f.description)}</span></button>`,
      )
      .join("") || "<p>No matches. Try “video” or “release”.</p>";
  document.querySelectorAll("video").forEach(video => {
    video.muted = true;
    observer.observe(video);
  });
  document.querySelector<HTMLElement>("#more")!.hidden = all || !!query;
}
function syncMotion() {
  document.querySelectorAll("video").forEach(video => {
    video.pause();
    observer.unobserve(video);
    observer.observe(video);
  });
}
const openFeature = createFeatureDialog(dialog, createHostBridge(status), syncMotion);
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
reducedMotion.addEventListener("change", syncMotion);
document.addEventListener("visibilitychange", syncMotion);
renderCards();
syncMotion();
