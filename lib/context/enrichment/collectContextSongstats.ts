import { z } from "zod";
import {
  lookupSongstatsContext,
  songstatsContextSchema,
} from "../providers/lookupSongstatsContext";
import { runContextEnrichment } from "./runContextEnrichment";
const schema = z.strictObject({
  subjectId: z.uuid(),
  collectionVersion: z.string().min(1).max(100),
  lookup: songstatsContextSchema,
});
type Dependencies = Omit<Parameters<typeof runContextEnrichment>[4], "call"> & {
  fetcher?: Parameters<typeof lookupSongstatsContext>[1];
};
/** Server-side source evidence; caller must confirm the identifier belongs to the request subject. */
export async function collectContextSongstats(
  actor: string,
  owner: string,
  requestId: string,
  input: z.input<typeof schema>,
  deps: Dependencies,
) {
  const args = schema.parse(input);
  const url = `https://api.songstats.com/enterprise/v1/${args.lookup.kind === "artist" ? "artists" : "tracks"}/info`;
  return runContextEnrichment(
    actor,
    owner,
    requestId,
    {
      key: "songstats-info-v1",
      topic: "songstats_context",
      subjectId: args.subjectId,
      provider: "songstats",
      model: "none",
      evidenceKind: "observation",
      input: args,
      sources: [{ url, kind: "provider_metadata", content: { ...args, role: "lookup_request" } }],
    },
    {
      ...deps,
      call: async () => {
        const result = await lookupSongstatsContext(args.lookup, deps.fetcher);
        return {
          content: result,
          coverage: result.status === "not_found" ? "unknown" : "partial",
          trace: result.trace,
          observedSources: [
            {
              url,
              kind: "provider_metadata",
              content: {
                httpStatus: result.trace.httpStatus,
                observedAt: result.trace.startedAt,
                payload: result.evidence,
              },
            },
          ],
          costUsd: null,
          costStatus: "unknown",
        };
      },
    },
  );
}
