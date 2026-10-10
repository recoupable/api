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
/** v2 adds the separate proposal field; ARTWORK_PROMPT alone lists only evidence fields. */
const ARTWORK_V2_PROMPT = `${ARTWORK_PROMPT} Also return proposedDesignChoices (string[]): neutral design choices directly grounded in the visible evidence, labelled as proposals, never a website, game, campaign or creative concept and never attributed to the artist; return [] when none are grounded. Keep proposals out of visibleObservations.`;
/** Same model: exact id with or without the provider prefix, or a dated snapshot of it. */
const isSelectedModel = (reported: string) => {
  const id = reported.replace(/^openai\//, "");
  return id === "gpt-6-astra" || /^gpt-6-astra-(?:\d{4}-\d{2}-\d{2}|\d{4})$/.test(id);
};
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
      input: { ...scoped, system: ARTWORK_V2_PROMPT },
      sources: [{ url, kind: "artwork", content: { assetVersion: input.assetVersion } }],
    },
    {
      ...deps,
      call: async () => {
        const result = await (deps.generate ?? generateContextObject)({
          system: ARTWORK_V2_PROMPT,
          input: { assetVersion: input.assetVersion },
          images: [url],
          schema: artworkBrandingSchema.omit({ scope: true }),
        });
        // Only a model id reported by the gateway's raw body can expose a substitution.
        const reportedModel = z
          .object({ reportedModel: z.string().nullish() })
          .passthrough()
          .safeParse(result.trace).data?.reportedModel;
        if (reportedModel && !isSelectedModel(reportedModel))
          throw new Error(`Selected artwork model unavailable: ${reportedModel}`);
        // Scope is a server fact about the subject, not a model claim.
        const content = validateArtworkBranding(
          artworkBrandingSchema.parse({ ...(result.content as object), scope: "release" }),
        );
        return { ...result, content };
      },
    },
  );
}
