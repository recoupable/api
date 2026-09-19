import { Script } from "node:vm";
import { generateObject } from "ai";
import { designSchema, experienceSchema, type Site, type SiteSnapshot } from "./schema";
import { generateBrandWorld } from "./brandWorld/generateBrandWorld";
import { implementationGuidance } from "./brandWorld/implementationGuidance";
export async function generateSite(site: Site, instruction: string): Promise<SiteSnapshot> {
  const model = process.env.SITES_MODEL || "openai/gpt-6-astra";
  const brandWorld = await generateBrandWorld(site, instruction, model);
  const { object } = await generateObject({
    model,
    maxRetries: 0,
    schema: designSchema.extend({ experience: experienceSchema }),
    system: implementationGuidance,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              name: site.name,
              brief: site.brief,
              releaseUrl: site.release_url,
              assets: site.assets,
              brandWorld: brandWorld.specification,
              currentDesign: site.draft?.design ?? null,
              instruction,
            }),
          },
          ...site.assets
            .filter(asset => asset.type === "image")
            .map(asset => ({
              type: "image" as const,
              image: new URL(asset.url),
            })),
        ],
      },
    ],
  });
  // Parse without executing. A syntax error must never replace the saved draft.
  const design = designSchema.extend({ experience: experienceSchema }).parse(object);
  new Script(design.experience.javascript);
  return {
    name: site.name,
    releaseUrl: site.release_url,
    assets: site.assets,
    design,
    brandWorld,
  };
}
