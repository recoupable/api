import { z } from "zod";
import { RESEARCH_PROMPT } from "./prompts";
import { generateContextObject } from "./generateContextObject";
import { runContextEnrichment } from "./runContextEnrichment";

type Dependencies = Omit<Parameters<typeof runContextEnrichment>[4], "call"> & {
  generate?: typeof generateContextObject;
};
/** Synthesize supplied sources for one confirmed artist and reject invented citations. */
export async function collectContextArtistResearch(
  actor: string,
  owner: string,
  requestId: string,
  input: {
    artistSubjectId: string;
    artistName: string;
    spotifyId: string;
    sources: Array<{ url: string; title: string; snippet: string; date?: string }>;
  },
  deps: Dependencies,
) {
  z.string()
    .regex(/^[A-Za-z0-9]{22}$/)
    .parse(input.spotifyId);
  const sources = z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string(),
        snippet: z.string(),
        date: z.string().optional(),
      }),
    )
    .min(1)
    .max(20)
    .parse(input.sources);
  return runContextEnrichment(
    actor,
    owner,
    requestId,
    {
      key: "artist-research-v1",
      topic: "artist_research",
      subjectId: input.artistSubjectId,
      provider: "ai-gateway",
      model: "openai/gpt-6-astra",
      input: { ...input, sources, system: RESEARCH_PROMPT },
      sources: sources.map(source => ({ url: source.url, kind: "web", content: source })),
    },
    {
      ...deps,
      call: async () => {
        const schema = z.object({
          artist: z.string(),
          claims: z.array(
            z.object({ claim: z.string(), sourceUrl: z.string(), date: z.string().nullable() }),
          ),
          identityCautions: z.array(z.string()),
          missingContext: z.array(z.string()),
        });
        const result = await (deps.generate ?? generateContextObject)({
          system: RESEARCH_PROMPT,
          input: { artist: input.artistName, spotifyId: input.spotifyId, sources },
          schema,
        });
        const content = schema.parse(result.content);
        if (content.claims.some(claim => !sources.some(source => source.url === claim.sourceUrl)))
          throw new Error("Unsupported research citation");
        return { ...result, content };
      },
    },
  );
}
