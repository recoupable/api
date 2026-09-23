import { z } from "zod";
import { collectContextMusicBrainz } from "../enrichment/collectContextMusicBrainz";
import { collectContextMlc } from "../enrichment/collectContextMlc";
import { collectContextSpotifyRelease } from "../enrichment/collectContextSpotifyRelease";
const schema = z.object({
  key: z.string(),
  subjectId: z.uuid(),
  module: z.enum(["musicbrainz", "mlc_recording", "spotify_release"]),
  state: z.enum(["ready_for_dispatch", "reuse_candidate"]),
});
type Node = z.infer<typeof schema>;
interface Dependencies {
  authorize: (actor: string, owner: string) => Promise<unknown>;
  authorizeProvider: (
    actor: string,
    owner: string,
    requestId: string,
    module: Node["module"],
  ) => Promise<unknown>;
  collectionVersion: string;
  loadInput?: (owner: string, requestId: string, node: Node) => Promise<unknown>;
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>;
  resolveRecording?: (owner: string, requestId: string, subjectId: string) => Promise<string>;
  acquireMusicBrainzPermit: () => Promise<void>;
  getMlcToken: () => Promise<string>;
  getSpotifyToken: () => Promise<string>;
  fetcher?: typeof fetch;
}
/** Trusted server dispatch only. Input resolution and provider/spend policy are required dependencies. */
export async function dispatchPlannedContextModule(
  actor: string,
  owner: string,
  requestId: string,
  input: unknown,
  deps: Dependencies,
) {
  const node = schema.parse(input);
  if (node.key !== `${node.subjectId}:${node.module}`)
    throw new Error("Module key does not match target");
  await deps.authorize(actor, owner);
  const version = z.string().min(1).max(100).parse(deps.collectionVersion);
  const values = deps.loadInput
    ? await deps.loadInput(owner, requestId, node)
    : await (
        await import("@/lib/supabase/context_requests/getContextModuleInput")
      ).getContextModuleInput(owner, requestId, node, version);
  const authorizeProvider = async () => {
    await deps.authorize(actor, owner);
    await deps.authorizeProvider(actor, owner, requestId, node.module);
  };
  let receipt: unknown;
  if (node.module === "spotify_release") {
    const args = z
      .strictObject({
        releaseId: z.string().regex(/^[A-Za-z0-9]{22}$/),
        collectionVersion: z.string().min(1).max(100),
        market: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .optional(),
        maxPages: z.number().int().min(1).max(50).optional(),
      })
      .parse(values);
    receipt = await collectContextSpotifyRelease(
      actor,
      owner,
      requestId,
      { ...args, subjectId: node.subjectId },
      {
        ...deps,
        getAccessToken: async () => {
          await authorizeProvider();
          return deps.getSpotifyToken();
        },
      },
    );
  } else {
    const args = z
      .strictObject({ isrc: z.string(), collectionVersion: z.string().min(1).max(100) })
      .parse(values);
    if (node.module === "musicbrainz") {
      receipt = await collectContextMusicBrainz(
        actor,
        owner,
        requestId,
        { ...args, recordingSubjectId: node.subjectId },
        {
          ...deps,
          acquirePermit: async () => {
            await authorizeProvider();
            await deps.acquireMusicBrainzPermit();
          },
        },
      );
    } else {
      receipt = await collectContextMlc(
        actor,
        owner,
        requestId,
        { ...args, subjectId: node.subjectId, operation: "recording" },
        {
          ...deps,
          getAccessToken: async () => {
            await authorizeProvider();
            return deps.getMlcToken();
          },
        },
      );
    }
  }
  return z.looseObject({ state: z.enum(["saved", "reused"]) }).parse(receipt);
}
