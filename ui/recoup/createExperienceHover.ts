import features from "./features";
import { escapeHtml } from "./escapeHtml";

/** Floating preview escapes the scrolling row's clipping and edge mask. */
export function createExperienceHover(container: HTMLElement, openFeature: (id: string) => void) {
  const panel = document.createElement("div");
  panel.className = "experience-hover";
  panel.hidden = true;
  panel.setAttribute("role", "button");
  panel.tabIndex = 0;
  document.body.append(panel);
  let timer: ReturnType<typeof setTimeout>;
  let current: HTMLElement | null = null;
  let videoHome: Comment | null = null;
  let liveVideo: HTMLVideoElement | null = null;
  const cancelTimer = () => clearTimeout(timer);
  const hide = () => {
    cancelTimer();
    panel.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    if (videoHome && liveVideo) videoHome.replaceWith(liveVideo);
    videoHome = null;
    liveVideo = null;
    panel.hidden = true;
    current = null;
  };
  const scheduleHide = () => {
    cancelTimer();
    timer = setTimeout(hide, 140);
  };
  const show = (card: HTMLElement) => {
    if (
      card === current ||
      !card.isConnected ||
      container.querySelector(".dragging") ||
      document.querySelector("dialog[open]")
    )
      return;
    const feature = features.find(item => item.id === card.dataset.id);
    if (!feature) return;
    hide();
    current = card;
    panel.setAttribute("aria-label", `Start ${feature.title}`);
    panel.innerHTML = `<div class="hover-thumbnail"><div class="hover-image-shade"></div><span class="hover-category">${escapeHtml(feature.category)}</span><h3>${escapeHtml(feature.title)}</h3></div><div class="hover-information"><p>${escapeHtml(feature.description)}</p></div>`;
    // Reuse the playing video instead of loading and seeking a second decoder.
    const source = card.querySelector("video");
    if (source) {
      videoHome = document.createComment("preview video home");
      source.replaceWith(videoHome);
      panel.querySelector(".hover-thumbnail")!.prepend(source);
      liveVideo = source;
    }
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
        { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      panel.querySelector<HTMLElement>(".hover-information")!.animate(
        [
          { opacity: 0, transform: "translateY(10px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 160, delay: 40, fill: "backwards", easing: "ease-out" },
      );
    }
    panel.onclick = () => {
      hide();
      openFeature(feature.id);
    };
  };
  container.addEventListener("pointerover", event => {
    if (event.pointerType !== "mouse" || !matchMedia("(hover: hover)").matches) return;
    const card = (event.target as HTMLElement).closest<HTMLElement>(".card");
    if (!card || card === current || card.contains(event.relatedTarget as Node | null)) return;
    cancelTimer();
    timer = setTimeout(() => show(card), 90);
  });
  container.addEventListener("pointerout", event => {
    const card = (event.target as HTMLElement).closest(".card");
    if (card && !card.contains(event.relatedTarget as Node | null)) scheduleHide();
  });
  container.addEventListener("focusin", event => {
    const card = (event.target as HTMLElement).closest<HTMLElement>(".card");
    if (card?.matches(":focus-visible")) show(card);
  });
  container.addEventListener("focusout", event => {
    if (!panel.contains(event.relatedTarget as Node | null)) scheduleHide();
  });
  // Keep trackpad momentum in the same row after the floating preview closes.
  let wheelRow: HTMLElement | null = null;
  let wheelUntil = 0;
  document.addEventListener(
    "wheel",
    event => {
      if (event.ctrlKey) return;
      const horizontal = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
      if (!horizontal || (!event.shiftKey && Math.abs(horizontal) < Math.abs(event.deltaY))) return;
      const overPanel = panel.contains(event.target as Node);
      const row = overPanel
        ? current?.closest<HTMLElement>(".experience-row")
        : Date.now() < wheelUntil
          ? wheelRow
          : null;
      if (!row?.isConnected || row.scrollWidth <= row.clientWidth) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? row.clientWidth : 1;
      row.scrollLeft += horizontal * unit;
      hide();
      wheelRow = row;
      wheelUntil = Date.now() + 220;
    },
    { passive: false },
  );
  panel.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    panel.click();
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
