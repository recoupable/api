import { z } from "zod";
import { ARTWORK_PROMPT } from "./prompts";
import { artworkBrandingSchema } from "./artworkBrandingSchema";
import { generateContextObject } from "./generateContextObject";
import { runContextEnrichment } from "./runContextEnrichment";
import { validateArtworkBranding } from "./validateArtworkBranding";

type Dependencies = Omit<Parameters<typeof runContextEnrichment>[4], "call"> & {
  generate?: typeof generateContextObject;
};
const SELECTED_MODEL = "openai/gpt-6-astra";
/** Accept the exact id or the gateway's provider-less spelling; any other model is a substitution. */
const isSelectedModel = (actual: string) =>
  actual === SELECTED_MODEL || actual === SELECTED_MODEL.split("/").pop();
/** Persist release-specific visual extraction; never infer an enduring artist brand. */
export async function collectContextArtwork(
  actor: string,
  owner: string,
  requestId: string,
  input: { releaseSubjectId: string; artworkUrl: string; assetVersion: string },
  deps: Dependencies,
) {
  const url = z.string().url().startsWith("https://").parse(input.artworkUrl);
  z.string().min(1).parse(input.assetVersion);
  const scoped = {
    scope: "release" as const,
    releaseSubjectId: input.releaseSubjectId,
    artworkUrl: url,
    assetVersion: input.assetVersion,
  };
  return runContextEnrichment(
    actor,
    owner,
    requestId,
    {
      key: "artwork-branding-v2",
      topic: "artwork_branding",
      subjectId: input.releaseSubjectId,
      provider: "ai-gateway",
      model: SELECTED_MODEL,
      input: { ...scoped, system: ARTWORK_PROMPT },
      sources: [{ url, kind: "artwork", content: { assetVersion: input.assetVersion } }],
    },
    {
      ...deps,
      call: async () => {
        const result = await (deps.generate ?? generateContextObject)({
          system: ARTWORK_PROMPT,
          input: { assetVersion: input.assetVersion },
          images: [url],
          schema: artworkBrandingSchema.omit({ scope: true }),
        });
        const actualModel = z
          .object({ actualModel: z.string().optional() })
          .passthrough()
          .safeParse(result.trace).data?.actualModel;
        if (actualModel !== undefined && !isSelectedModel(actualModel))
          throw new Error(`Selected artwork model unavailable: ${actualModel}`);
        // Scope is a server fact about the subject, not a model claim.
        const content = validateArtworkBranding(
          artworkBrandingSchema.parse({ ...(result.content as object), scope: "release" }),
        );
        return { ...result, content };
      },
    },
  );
}
