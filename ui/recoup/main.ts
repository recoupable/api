import { createExperienceHover } from "./createExperienceHover";
import { groupExperienceCards } from "./groupExperienceCards";
import { escapeHtml } from "./escapeHtml";
import { createHostBridge } from "./createHostBridge";
import { startExperience } from "./startExperience";
import features from "./features";

const root = document.getElementById("root")!;
let previewsPaused = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
root.innerHTML = `<main><section class="hero" aria-labelledby="hero-title"><div><h1 id="hero-title">Your record label.<br>Inside ChatGPT.</h1><p class="hero-description">Start with a song, album, artist, or entire catalog. Manage your roster, create content, grow your audience, and find your next opportunity.</p></div></section><section id="cards" aria-label="Music workflows"></section><footer><button id="motion" aria-pressed="false">Pause previews</button><p id="connection" class="connection" role="status">Connecting to your conversation…</p></footer></main>`;
const cards = document.querySelector<HTMLElement>("#cards")!;
const status = document.querySelector<HTMLElement>("#connection")!;
const motion = document.querySelector<HTMLButtonElement>("#motion")!;
const observer = new IntersectionObserver(
  entries =>
    entries.forEach(entry => {
      const video = entry.target as HTMLVideoElement;
      if (entry.isIntersecting && !reducedMotion.matches && !previewsPaused && !document.hidden)
        void video.play().catch(() => {});
      else video.pause();
    }),
  { threshold: 0.15 },
);
function renderCards() {
  cards.querySelectorAll("video").forEach(video => video.pause());
  observer.disconnect();
  cards.innerHTML =
    features
      .map(
        f =>
          `<button class="card" data-id="${f.id}" aria-label="${escapeHtml(f.title)}"><span class="media"><span aria-hidden="true" class="art art-${f.category.toLowerCase()}"><span>${escapeHtml(f.category)}</span><strong>${escapeHtml(f.title)}</strong></span>${f.video ? `<video muted loop playsinline preload="metadata" aria-hidden="true" src="${escapeHtml(f.video)}"></video>` : ""}<span class="preview-label" aria-hidden="true">EXAMPLE PREVIEW</span><span class="card-arrow" aria-hidden="true">↗</span></span><span class="card-category">${escapeHtml(f.category)}</span><span class="card-title">${escapeHtml(f.title)}</span><span class="card-description">${escapeHtml(f.description)}</span></button>`,
      )
      .join("") ||
    `<div class="empty"><p class="eyebrow">LET’S FIND YOUR NEXT MOVE</p><h3>No workflows found</h3><p>Please try again later.</p></div>`;
  groupExperienceCards(cards);
  cards.querySelectorAll("video").forEach(video => {
    video.muted = true;
    video.addEventListener("loadeddata", () => video.classList.add("loaded"));
    video.addEventListener("error", () => {
      video.hidden = true;
      observer.unobserve(video);
    });
    observer.observe(video);
  });
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
const openFeature = startExperience(createHostBridge(status), status, cards);
createExperienceHover(cards, openFeature);
cards.onclick = event => {
  const target = event.target as HTMLElement;
  const card = target.closest<HTMLElement>("[data-id]");
  if (card) openFeature(card.dataset.id!);
};
motion.addEventListener("click", () => {
  previewsPaused = !previewsPaused;
  syncMotion();
});
reducedMotion.addEventListener("change", syncMotion);
document.addEventListener("visibilitychange", syncMotion);
renderCards();
syncMotion();
