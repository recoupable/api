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
    section.innerHTML = `<div class="section-heading"><h3 id="section-${category}">${title}</h3><div class="row-controls"><button data-scroll="-1" aria-label="Previous ${title.toLowerCase()}">‹</button><button data-scroll="1" aria-label="Next ${title.toLowerCase()}">›</button></div></div><div class="experience-row" tabindex="0" role="region" aria-label="${title}"></div>`;
    const row = section.querySelector<HTMLElement>(".experience-row")!;
    matching.forEach(button => row.append(button));
    const updateControls = () => {
      const controls = section.querySelectorAll<HTMLButtonElement>("[data-scroll]");
      controls[0].disabled = row.scrollLeft <= 5;
      controls[1].disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 1;
    };
    section.querySelectorAll<HTMLButtonElement>("[data-scroll]").forEach(button => {
      button.onclick = () =>
        row.scrollBy({
          left: Number(button.dataset.scroll) * row.clientWidth * 0.85,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        });
    });
    row.addEventListener("scroll", updateControls, { passive: true });
    const resizeObserver = new ResizeObserver(updateControls);
    resizeObserver.observe(row);
    rowObservers.push(resizeObserver);
    container.append(section);
    updateControls();
  }
}
