import { z } from "zod";
import { runContextEnrichment } from "@/lib/context/enrichment/runContextEnrichment";
import { ARTWORK_PROMPT } from "@/lib/context/enrichment/prompts";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { generateProductionObject } from "./generateProductionObject";
import { researchArtist } from "./researchArtist";
import { authorizeSiteWorkspace } from "../authorizeSiteWorkspace";
import type { Site } from "../schema";
import type { prepareSiteContext } from "./prepareSiteContext";
/** Store neutral artwork and sourced research independently from creative proposals. */
export async function enrichSiteContext(
  site: Site,
  accountId: string,
  context: Awaited<ReturnType<typeof prepareSiteContext>>,
  topic: "artwork_branding" | "artist_research",
) {
  const artwork = context.release.artwork;
  const url = topic === "artwork_branding" ? artwork : context.release.url;
  if (!url) return;
  return runContextEnrichment(
    accountId,
    site.owner_id,
    context.requestId,
    {
      key: `sites-context-${topic}-v2`,
      topic,
      subjectId: context.subjectId,
      provider: "recoup",
      model: "sites-model",
      input: {
        trackId: context.metadata.trackId,
        artwork: topic === "artwork_branding" ? artwork : null,
      },
      sources: [
        {
          url,
          kind: topic === "artwork_branding" ? "artwork" : "provider_metadata",
          content: { trackId: context.metadata.trackId },
        },
      ],
    },
    {
      rpc: callContextRpc,
      authorize: authorizeSiteWorkspace,
      call: async () => {
        const content =
          topic === "artist_research"
            ? await researchArtist(context.release, accountId)
            : await generateProductionObject(
                z.object({
                  visibleObservations: z.array(z.string()),
                  palette: z.array(z.object({ color: z.string(), role: z.string() })),
                  typography: z.string(),
                  composition: z.string(),
                  texturesAndMaterials: z.array(z.string()),
                  motifs: z.array(z.string()),
                  visualInterpretation: z.string(),
                  uncertainties: z.array(z.string()),
                }),
                ARTWORK_PROMPT,
                { title: context.metadata.title },
                [artwork!],
                accountId,
                site.id,
              );
        return {
          content,
          coverage: "partial",
          costUsd: null,
          costStatus: "unknown",
          trace: {
            billing: "Sites metered provider path",
            provenance:
              topic === "artist_research"
                ? "Artist identity anchored by Spotify; returned public-search citations are in content."
                : "Artwork observations",
          },
        };
      },
    },
  );
}
