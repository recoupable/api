import { getGenerationFailure } from "./getGenerationFailure";
import { getSiteModelOptions } from "./getSiteModelOptions";
import { loadSiteSkill } from "./skills/loadSiteSkill";
import { Script } from "node:vm";
import { generateSiteObject } from "./generateSiteObject";
import { designSchema, experienceSchema, type Site, type SiteSnapshot } from "./schema";
import { generateBrandWorld } from "./brandWorld/generateBrandWorld";
import { implementationGuidance } from "./brandWorld/implementationGuidance";
export async function generateSite(
  site: Site,
  instruction: string,
  accountId?: string,
): Promise<SiteSnapshot> {
  if (accountId) await (await import("./production/requireCredits")).requireCredits(accountId);
  const modelOptions = getSiteModelOptions(undefined, "low", 65536);
  const { model } = modelOptions;
  const brandWorld = await generateBrandWorld(site, instruction, model, accountId);
  if (accountId) await (await import("./production/requireCredits")).requireCredits(accountId);
  const { object, usage } = await generateSiteObject(
    {
      ...modelOptions,
      maxRetries: 0,
      schema: designSchema.extend({ experience: experienceSchema }),
      system: `${implementationGuidance}\n\n${loadSiteSkill().skill}\n${loadSiteSkill().buildAndReview}`,
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
    },
    accountId,
    site.id,
    true,
  ).catch(error => {
    console.error("[sites:implementation]", getGenerationFailure(error));
    throw error;
  });
  if (accountId)
    await (
      await import("@/lib/credits/handleChatCredits")
    ).handleChatCredits({
      usage,
      model,
      accountId,
      source: "api",
      resourceUrl: `/sites/${site.id}`,
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
