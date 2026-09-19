import { generateObject } from "ai";
import type { Site } from "../schema";
import { brandWorldSchema } from "./schema";
import { artworkGuidance } from "./artworkGuidance";
import { worldGuidance } from "./worldGuidance";
import { qualityGuidance } from "./qualityGuidance";

/** Extract visual evidence and compile an inspectable art direction before code generation. */
export async function generateBrandWorld(site: Site, instruction: string, model: string) {
  const sources = site.assets.map((asset, sourceIndex) => ({ ...asset, sourceIndex }));
  const images = sources.filter(asset => asset.type === "image");
  const { object } = await generateObject({
    model,
    maxRetries: 0,
    schema: brandWorldSchema,
    system: [
      "You are an art director planning a complete release-specific fan website. Return a concrete brand-world specification, not website code or generic design advice.",
      artworkGuidance,
      worldGuidance,
      qualityGuidance,
    ].join("\n\n"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              name: site.name,
              brief: site.brief,
              instruction,
              sources,
              previousWorld: site.draft?.brandWorld ?? null,
            }),
          },
          ...images.map(asset => ({ type: "image" as const, image: new URL(asset.url) })),
        ],
      },
    ],
  });
  const specification = brandWorldSchema.parse(object);
  if (specification.evidenceMode !== (images.length ? "artwork" : "brief-only"))
    throw new Error("Brand-world evidence does not match supplied artwork");
  if (images.length && !specification.observations.length)
    throw new Error("Brand-world artwork observations are missing");
  for (const observation of specification.observations) {
    if (sources[observation.sourceIndex]?.type !== "image")
      throw new Error("Brand-world observation references unavailable artwork");
  }
  for (const asset of specification.assets) {
    if (
      asset.production === "supplied" &&
      (asset.sourceIndex === null || !sources[asset.sourceIndex])
    )
      throw new Error("Brand-world asset references an unavailable source");
    if (asset.production !== "supplied" && asset.sourceIndex !== null)
      throw new Error("Procedural or deferred assets cannot claim a supplied source");
  }
  return { version: 1 as const, model, sourceAssets: site.assets, specification };
}
