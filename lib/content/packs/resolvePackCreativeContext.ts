import type { ReleasePackBrief } from "./releasePackSchema";

/** Carry the selected world into production; inspiration-only media never becomes an image input. */
export function resolvePackCreativeContext(brief: ReleasePackBrief): ReleasePackBrief {
  const context = brief.creative_context;
  const direction = context?.directions.find(item => item.id === context.selection?.direction_id);
  if (!context || !direction) return brief;
  const images = context.references
    .filter(
      reference =>
        direction.reference_ids.includes(reference.id) &&
        reference.usage === "production" &&
        reference.media_type === "image",
    )
    .map(reference => reference.url);
  return {
    ...brief,
    creative_direction: [
      `${direction.name}: ${direction.concept}`,
      ...(direction.palette.length ? [`Palette: ${direction.palette.join(", ")}.`] : []),
      ...(direction.typography ? [`Typography: ${direction.typography}.`] : []),
    ].join("\n"),
    reference_image_urls: [...new Set([...brief.reference_image_urls, ...images])],
  };
}
