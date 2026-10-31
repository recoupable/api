import features from "./features";

/** Group rendered cards without replacing their buttons or dialog behavior. */
let rowObservers: ResizeObserver[] = [];
export function groupExperienceCards(container: HTMLElement) {
  rowObservers.forEach(observer => observer.disconnect());
  rowObservers = [];
  const sections = [
    ["Create", "Create content"],
    ["Promote", "Promote your music"],
    ["Discover", "Discover opportunities"],
    ["Catalog", "Understand your catalog"],
  ];
  const buttons = [...container.querySelectorAll<HTMLElement>(".card")];
  if (!buttons.length) return;
  for (const [category, title] of sections) {
    const matching = buttons.filter(button =>
      features.some(feature => feature.id === button.dataset.id && feature.category === category),
    );
    if (!matching.length) continue;
    const section = document.createElement("section");
    section.className = "experience-section";
    section.setAttribute("aria-labelledby", `section-${category}`);
    section.innerHTML = `<div class="section-heading"><h3 id="section-${category}">${title}</h3></div><div class="experience-row" tabindex="0" role="region" aria-label="${title}"></div>`;
    const row = section.querySelector<HTMLElement>(".experience-row")!;
    const looping = matching.length > 1;
    matching.forEach(button => row.append(button));
    // One node per workflow. Keep one offscreen card before the viewport.
    if (looping) row.prepend(matching[matching.length - 1]);
    row.style.overflowAnchor = "none";
    let originX = 0;
    let originScroll = 0;
    let activePointer: number | null = null;
    let dragged = false;
    let stride = 0;
    const measureLoop = () => {
      if (!looping) return;
      const children = [...row.children] as HTMLElement[];
      const nextStride = children[1].offsetLeft - children[0].offsetLeft;
      if (nextStride <= 0 || nextStride === stride) return;
      const relativePosition = stride ? row.scrollLeft / stride : 1;
      stride = nextStride;
      row.scrollLeft = stride * relativePosition;
      row.classList.add("has-more");
    };
    const wrapScroll = () => {
      // Reordering offscreen nodes keeps their video decoder and listeners intact.
      if (!stride || row.scrollWidth - row.clientWidth < stride * 1.5) return;
      let position = row.scrollLeft;
      while (position >= stride * 1.5) {
        row.append(row.firstElementChild!);
        position -= stride;
        originScroll -= stride;
      }
      while (position < stride * 0.5) {
        row.prepend(row.lastElementChild!);
        position += stride;
        originScroll += stride;
      }
      if (position !== row.scrollLeft) row.scrollLeft = position;
    };
    row.addEventListener("pointerdown", event => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      activePointer = event.pointerId;
      originX = event.clientX;
      originScroll = row.scrollLeft;
      dragged = false;
    });
    row.addEventListener("pointermove", event => {
      if (activePointer !== event.pointerId || !event.buttons) return;
      const distance = event.clientX - originX;
      if (!dragged && Math.abs(distance) < 6) return;
      dragged = true;
      row.setPointerCapture(event.pointerId);
      row.classList.add("dragging");
      row.scrollLeft = originScroll - distance;
      wrapScroll();
      event.preventDefault();
    });
    const endDrag = () => {
      activePointer = null;
      row.classList.remove("dragging");
    };
    row.addEventListener("pointerup", endDrag);
    row.addEventListener("pointercancel", endDrag);
    row.addEventListener("lostpointercapture", endDrag);
    row.addEventListener(
      "click",
      event => {
        if (!dragged) return;
        event.preventDefault();
        event.stopPropagation();
        dragged = false;
      },
      true,
    );
    row.addEventListener("dragstart", event => event.preventDefault());
    row.addEventListener("keydown", event => {
      if (event.target !== row || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      row.scrollLeft += event.key === "ArrowRight" ? stride : -stride;
      wrapScroll();
    });
    row.addEventListener("scroll", wrapScroll, { passive: true });
    const resizeObserver = new ResizeObserver(measureLoop);
    resizeObserver.observe(row);
    rowObservers.push(resizeObserver);
    container.append(section);
    measureLoop();
  }
}
