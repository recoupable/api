import { z } from "zod";
import { collectSpotifyReleaseContext } from "../providers/collectSpotifyReleaseContext";
import { runContextEnrichment } from "./runContextEnrichment";
const schema = z.strictObject({
  subjectId: z.uuid(),
  releaseId: z.string().regex(/^[A-Za-z0-9]{22}$/),
  collectionVersion: z.string().min(1).max(100),
  market: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  maxPages: z.number().int().min(1).max(50).default(10),
});
type Dependencies = Omit<Parameters<typeof runContextEnrichment>[4], "call"> & {
  getAccessToken: () => Promise<string>;
  fetcher?: typeof fetch;
};
/** Persist a paginated provider observation. Server caller must bind releaseId to this request's release subject. */
export async function collectContextSpotifyRelease(
  actor: string,
  owner: string,
  requestId: string,
  input: z.input<typeof schema>,
  deps: Dependencies,
) {
  const args = schema.parse(input);
  const url = new URL(`https://api.spotify.com/v1/albums/${args.releaseId}`);
  if (args.market) url.searchParams.set("market", args.market);
  return runContextEnrichment(
    actor,
    owner,
    requestId,
    {
      key: "spotify-release-pages-v1",
      topic: "spotify_release_context",
      subjectId: args.subjectId,
      provider: "spotify",
      model: "none",
      evidenceKind: "observation",
      input: args,
      sources: [
        { url: url.href, kind: "provider_metadata", content: { ...args, role: "lookup_request" } },
      ],
    },
    {
      ...deps,
      call: async () => {
        const token = await deps.getAccessToken();
        const result = await collectSpotifyReleaseContext(
          { releaseId: args.releaseId, market: args.market, maxPages: args.maxPages },
          token,
          deps.fetcher,
        );
        return {
          content: { ...result, scope: "workspace_private" },
          coverage: "partial",
          trace: {
            provider: "spotify",
            requests: result.snapshots.map(({ payload: _payload, ...trace }) => trace),
          },
          // One versioned collection source includes exact URL/status/payload for every page.
          observedSources: [
            { url: url.href, kind: "provider_metadata", content: { pages: result.snapshots } },
          ],
          costUsd: null,
          costStatus: "unknown",
        };
      },
    },
  );
}
