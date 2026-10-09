import features from "./features";

/** Search the full library; a selected category narrows the results. */
export function filterWorkflows(query: string, category = "All") {
  const term = query.trim().toLowerCase();
  return features.filter(
    feature =>
      (category === "All" || feature.category === category) &&
      `${feature.title} ${feature.description} ${feature.category} ${feature.outputs.join(" ")}`
        .toLowerCase()
        .includes(term),
  );
}
