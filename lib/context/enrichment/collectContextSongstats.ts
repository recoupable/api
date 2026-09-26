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
/** Server-side source evidence; lookup identity is bound to the saved request subject. */
export async function collectContextSongstats(
  actor: string,
  owner: string,
  requestId: string,
  input: z.input<typeof schema>,
  deps: Dependencies,
) {
  const args = schema.parse(input);
  const authorizeLookup = async () => {
    await deps.authorize(actor, owner);
    const resolved = songstatsContextSchema.parse(
      await deps.rpc("resolve_context_songstats_lookup", {
        p_owner: owner,
        p_request: requestId,
        p_subject: args.subjectId,
        p_kind: args.lookup.kind,
        p_identifier: "isrc" in args.lookup ? "isrc" : "spotify_id",
      }),
    );
    const matches =
      resolved.kind === args.lookup.kind &&
      ("isrc" in args.lookup
        ? "isrc" in resolved && resolved.isrc === args.lookup.isrc
        : "spotifyId" in args.lookup &&
          "spotifyId" in resolved &&
          resolved.spotifyId === args.lookup.spotifyId);
    if (!matches) throw new Error("Songstats identifier does not match the context subject");
  };
  await authorizeLookup();
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
      authorize: authorizeLookup,
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
