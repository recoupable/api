import { buildRevealSchema } from "@/lib/sites/production/buildReveal";
import type { SiteAsset, SiteSnapshot } from "@/lib/sites/schema";
/** Persist only the customer-facing milestones for the authenticated progress endpoint. */
export async function revealBuildStep(
  concept: string,
  assets: SiteAsset[],
  preview?: SiteSnapshot,
  refinement?: string,
) {
  "use step";
  return buildRevealSchema.parse({
    concept: concept.slice(0, 4000),
    assets,
    preview,
    refinement: refinement?.slice(0, 4000),
  });
}
