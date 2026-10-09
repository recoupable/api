import features from "./features";

const featured = ["calendar", "cover", "play", "lyrics", "wave", "radar"];

/** Search the full library; a selected category narrows the results. */
export function filterWorkflows(query: string, category: string) {
  const term = query.trim().toLowerCase();
  const source =
    category === "Featured" && !term
      ? featured.map(id => features.find(feature => feature.id === id)!)
      : features;
  return source.filter(
    feature =>
      (category === "Featured" || category === "All" || feature.category === category) &&
      `${feature.title} ${feature.description} ${feature.category} ${feature.outputs.join(" ")}`
        .toLowerCase()
        .includes(term),
  );
}
