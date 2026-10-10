import features from "./features";
import { escapeHtml } from "./escapeHtml";

/** Floating preview escapes the scrolling row's clipping and edge mask. */
export function createExperienceHover(container: HTMLElement, openFeature: (id: string) => void) {
  const panel = document.createElement("div");
  panel.className = "experience-hover";
  panel.hidden = true;
  panel.setAttribute("role", "region");
  document.body.append(panel);
  let timer: ReturnType<typeof setTimeout>;
  let current: HTMLElement | null = null;
  const cancelTimer = () => clearTimeout(timer);
  const hide = () => {
    cancelTimer();
    panel.getAnimations().forEach(animation => animation.cancel());
    panel.querySelector("video")?.pause();
    panel.hidden = true;
    current = null;
  };
  const scheduleHide = () => {
    cancelTimer();
    timer = setTimeout(hide, 140);
  };
  const show = (card: HTMLElement) => {
    if (
      !card.isConnected ||
      container.querySelector(".dragging") ||
      document.querySelector("dialog[open]")
    )
      return;
    const feature = features.find(item => item.id === card.dataset.id);
    if (!feature) return;
    hide();
    current = card;
    panel.setAttribute("aria-label", `${feature.title} preview`);
    panel.innerHTML = `<div class="hover-thumbnail">${feature.video ? `<video muted loop playsinline src="${escapeHtml(feature.video)}" aria-hidden="true"></video>` : ""}<div class="hover-image-shade"></div><span class="hover-category">${escapeHtml(feature.category)}</span><h3>${escapeHtml(feature.title)}</h3></div><div class="hover-information"><p>${escapeHtml(feature.description)}</p><div class="hover-actions"><button class="hover-start">Start experience <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div></div>`;
    const rect = card.getBoundingClientRect();
    const width = Math.min(rect.width * 1.35, 500, window.innerWidth - 32);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(16, Math.min(rect.left - (width - rect.width) / 2, window.innerWidth - width - 16))}px`;
    panel.hidden = false;
    panel.style.top = `${Math.max(16, Math.min(rect.top - 40, window.innerHeight - panel.offsetHeight - 16))}px`;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const expanded = panel.getBoundingClientRect();
      const scale = rect.width / expanded.width;
      // Grow from the original thumbnail, revealing the lower panel as it opens.
      panel.animate(
        [
          {
            transform: `translate(${rect.left - expanded.left}px, ${rect.top - expanded.top}px) scale(${scale})`,
            clipPath: `inset(0 0 ${Math.max(0, expanded.height - rect.height / scale)}px 0 round 16px)`,
          },
          { transform: "none", clipPath: "inset(0 0 0 0 round 16px)" },
        ],
        { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      panel.querySelector<HTMLElement>(".hover-information")!.animate(
        [
          { opacity: 0, transform: "translateY(10px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 240, delay: 70, fill: "backwards", easing: "ease-out" },
      );
    }
    const source = card.querySelector("video");
    const video = panel.querySelector("video");
    if (video) {
      video.muted = true;
      if (source)
        video.addEventListener(
          "loadedmetadata",
          () => {
            video.currentTime = source.currentTime;
          },
          { once: true },
        );
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
        void video.play().catch(() => {});
    }
    panel.querySelector<HTMLButtonElement>(".hover-start")!.onclick = () => {
      hide();
      openFeature(feature.id);
    };
  };
  container.addEventListener("pointerover", event => {
    if (event.pointerType !== "mouse" || !matchMedia("(hover: hover)").matches) return;
    const card = (event.target as HTMLElement).closest<HTMLElement>(".card");
    if (!card || card === current || card.contains(event.relatedTarget as Node | null)) return;
    cancelTimer();
    timer = setTimeout(() => show(card), 250);
  });
  container.addEventListener("pointerout", event => {
    const card = (event.target as HTMLElement).closest(".card");
    if (card && !card.contains(event.relatedTarget as Node | null)) scheduleHide();
  });
  container.addEventListener("focusin", event => {
    const card = (event.target as HTMLElement).closest<HTMLElement>(".card");
    if (card) show(card);
  });
  container.addEventListener("focusout", event => {
    if (!panel.contains(event.relatedTarget as Node | null)) scheduleHide();
  });
  panel.addEventListener("pointerenter", cancelTimer);
  panel.addEventListener("pointerleave", scheduleHide);
  panel.addEventListener("focusin", cancelTimer);
  panel.addEventListener("focusout", scheduleHide);
  container.addEventListener("pointerdown", hide);
  container.addEventListener("click", hide);
  document.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") hide();
  });
  return hide;
}
