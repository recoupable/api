import features from "./features";
import { escapeHtml } from "./escapeHtml";
import { createHostBridge } from "./createHostBridge";
import { createFeatureDialog } from "./createFeatureDialog";

const root = document.getElementById("root")!;
const starters = ["calendar", "cover", "play", "lyrics", "wave", "radar"];
let all = false;
let paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
let query = "";
root.innerHTML = `<header><a class="brand" href="#" aria-label="Recoup home"><img src="__WORDMARK__" alt="Recoup"></a><button id="motion" type="button"></button></header><main><section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><p class="eyebrow">A WHOLE MUSIC TEAM. YOUR NEXT MOVE.</p><h1 id="hero-title">Your music.<br><em>A whole<br>new world.</em></h1><p class="hero-description">Make something impossible to scroll past.<br>Find the fans. Plan the next chapter.</p><div class="hero-actions"><a class="hero-primary" href="#experiences">Find your next move <span aria-hidden="true">↗</span></a><button id="surprise" type="button">Surprise me <span aria-hidden="true">✳</span></button></div></div><div class="hero-stage"><button id="hero-feature" class="hero-feature" type="button" aria-label="Make a fan experience"><video muted loop playsinline preload="metadata" aria-hidden="true" src="${features.find(f => f.id === "play")!.video}"></video><span class="hero-caption"><span><small>IMAGINE THIS WITH YOUR MUSIC</small><strong id="hero-feature-title">Make a fan experience</strong></span><span class="hero-arrow" aria-hidden="true">↗</span></span></button><div class="hero-switcher" aria-label="Featured experiences"><button type="button" data-feature="play" aria-pressed="true">01 / Fan experiences</button><button type="button" data-feature="cover" aria-pressed="false">02 / Cover art</button><button type="button" data-feature="film" aria-pressed="false">03 / Music videos</button></div></div></section><div id="experiences" class="toolbar"><div><p class="eyebrow">SMALL START. BIG POSSIBILITIES.</p><h2>Follow your curiosity.</h2></div><label class="search"><span class="sr-only">Search experiences</span><input id="search" type="search" placeholder="Find your next move…"></label></div><section id="cards" aria-label="Music experiences"></section><button id="more" class="more">See all experiences</button><p id="connection" class="connection" role="status">Connecting to your conversation…</p></main><dialog id="detail" aria-labelledby="detail-title"><button class="close" aria-label="Close experience">×</button><div id="detail-content"></div></dialog>`;
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
          `<button class="card" data-id="${f.id}">${f.video ? `<video muted loop playsinline preload="metadata" aria-hidden="true" src="${f.video}"></video>` : `<span aria-hidden="true" class="art art-${f.category.toLowerCase()}"><span>${escapeHtml(f.category)}</span><strong>${escapeHtml(f.title)}</strong></span>`}<span class="card-title">${escapeHtml(f.title)}</span><span class="card-description">${escapeHtml(f.description)}</span><span class="try">Explore →</span></button>`,
      )
      .join("") || "<p>No matches. Try “video” or “release”.</p>";
  document.querySelectorAll("video").forEach(video => {
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
const openFeature = createFeatureDialog(dialog, createHostBridge(status), syncMotion);
let featuredId = "play";
document.querySelector("#hero-feature")!.addEventListener("click", () => openFeature(featuredId));
document.querySelector("#surprise")!.addEventListener("click", () => {
  openFeature(features[Math.floor(Math.random() * features.length)].id);
});
document.querySelectorAll<HTMLButtonElement>("[data-feature]").forEach(button => {
  button.addEventListener("click", () => {
    featuredId = button.dataset.feature!;
    const feature = features.find(f => f.id === featuredId)!;
    const video = document.querySelector<HTMLVideoElement>(".hero-feature video")!;
    video.src = feature.video;
    document.querySelector("#hero-feature-title")!.textContent = feature.title;
    document.querySelector("#hero-feature")!.setAttribute("aria-label", feature.title);
    document.querySelectorAll<HTMLButtonElement>("[data-feature]").forEach(tab => {
      tab.setAttribute("aria-pressed", String(tab === button));
    });
    syncMotion();
  });
});
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
document.addEventListener("visibilitychange", syncMotion);
renderCards();
syncMotion();
