import { z } from "zod";
import { ARTWORK_PROMPT } from "./prompts";
import { generateContextObject } from "./generateContextObject";
import { runContextEnrichment } from "./runContextEnrichment";

type Dependencies = Omit<Parameters<typeof runContextEnrichment>[4], "call"> & {
  generate?: typeof generateContextObject;
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
  return runContextEnrichment(
    actor,
    owner,
    requestId,
    {
      key: "artwork-branding-v1",
      topic: "artwork_branding",
      subjectId: input.releaseSubjectId,
      provider: "ai-gateway",
      model: "openai/gpt-6-astra",
      input: { ...input, system: ARTWORK_PROMPT },
      sources: [{ url, kind: "artwork", content: { assetVersion: input.assetVersion } }],
    },
    {
      ...deps,
      call: () =>
        (deps.generate ?? generateContextObject)({
          system: ARTWORK_PROMPT,
          input: { assetVersion: input.assetVersion },
          images: [url],
          schema: z.object({
            visibleObservations: z.array(z.string()),
            palette: z.array(z.object({ color: z.string(), role: z.string() })),
            typography: z.string(),
            composition: z.string(),
            texturesAndMaterials: z.array(z.string()),
            motifs: z.array(z.string()),
            visualInterpretation: z.string(),
            uncertainties: z.array(z.string()),
          }),
        }),
    },
  );
}
