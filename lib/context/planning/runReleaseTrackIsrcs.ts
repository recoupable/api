import { createHash } from "node:crypto";
import { z } from "zod";
import { authorizeContextOwner } from "@/lib/context/authorizeContextOwner";
import { collectSpotifyReleaseTrackIsrcs } from "@/lib/context/providers/collectSpotifyReleaseTrackIsrcs";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { loadCurrentReleaseTrackSlots } from "./loadCurrentReleaseTrackSlots";

const claimSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("claimed"), attemptId: z.uuid() }),
  z.object({ state: z.literal("unknown"), attemptId: z.uuid(), reason: z.string() }),
]);
const receiptSchema = z.object({
  state: z.literal("saved"),
  resultId: z.uuid(),
  observedIsrcCount: z.number().int().nonnegative(),
  missingIsrcCount: z.number().int().nonnegative(),
  failedLookupCount: z.number().int().nonnegative(),
});

type Dependencies = {
  /** Recorded executions must collect against the exact source used to build their plan. */
  expectedSourceResultId?: string;
  authorize?: (actor: string, owner: string) => Promise<{ ownerId: string }>;
  rpc?: (name: string, params: Record<string, unknown>) => Promise<unknown>;
  getSpotifyToken?: () => Promise<string>;
  fetcher?: typeof fetch;
};

/** Explicitly gated, source-bound lookup of up to 100 tracks on one current release. */
export async function runReleaseTrackIsrcs(
  actor: string,
  owner: string,
  requestId: string,
  subjectId: string,
  deps: Dependencies = {},
) {
  for (const value of [actor, owner, requestId, subjectId]) z.uuid().parse(value);
  const expectedSourceResultId = z.uuid().optional().parse(deps.expectedSourceResultId);
  const enabled = () => process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED === "true";
  if (!enabled()) throw new Error("Spotify release track lookup is not enabled");
  const authorize =
    deps.authorize ??
    (async (account: string, selectedOwner: string) => {
      const access = await authorizeContextOwner(
        account,
        selectedOwner === account ? undefined : selectedOwner,
      );
      if (access.ownerId !== selectedOwner) throw new Error("Access denied to context owner");
      return { ownerId: access.ownerId };
    });
  const rpc = deps.rpc ?? callContextRpc;
  const read = () =>
    loadCurrentReleaseTrackSlots(actor, owner, requestId, subjectId, { authorize, rpc });
  const release = await read();
  if (expectedSourceResultId && release.sourceResultId !== expectedSourceResultId)
    throw new Error("Release track evidence changed since execution planning");
  if (release.slots.length < 1 || release.slots.length > 100)
    throw new Error("Release track lookup currently supports 1–100 positions");
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        recipe: "spotify-release-track-isrcs-v1",
        owner,
        requestId,
        subjectId,
        sourceResultId: release.sourceResultId,
        slots: release.slots.map(slot => [slot.slotIndex, slot.spotifyTrackId]),
      }),
    )
    .digest("hex");
  const getSpotifyToken =
    deps.getSpotifyToken ??
    (async () => {
      const { default: generateAccessToken } = await import("@/lib/spotify/generateAccessToken");
      const token = await generateAccessToken();
      if (!token.access_token) throw new Error("Spotify authentication unavailable");
      return token.access_token;
    });
  // Obtain credentials before claiming; a missing token has not touched Spotify.
  const token = await getSpotifyToken();
  if (!token) throw new Error("Spotify authentication unavailable");
  const claim = claimSchema.parse(
    await rpc("claim_context_release_track_isrcs", {
      p_owner: owner,
      p_request: requestId,
      p_subject: subjectId,
      p_release_result: release.sourceResultId,
      p_fingerprint: fingerprint,
    }),
  );
  if (claim.state === "unknown")
    return { state: "unknown" as const, attemptId: claim.attemptId, reason: claim.reason };
  const authorizeBatch = async () => {
    if (!enabled()) throw new Error("Spotify release track lookup is not enabled");
    const current = await read();
    if (!enabled()) throw new Error("Spotify release track lookup is not enabled");
    if (
      current.sourceResultId !== release.sourceResultId ||
      JSON.stringify(current.slots) !== JSON.stringify(release.slots)
    )
      throw new Error("Release track positions changed before provider lookup");
  };
  try {
    const collected = await collectSpotifyReleaseTrackIsrcs(
      release.slots.map(slot => ({
        slotIndex: slot.slotIndex,
        spotifyTrackId: slot.spotifyTrackId,
      })),
      token,
      deps.fetcher,
      authorizeBatch,
    );
    if (collected.observations.every(observation => observation.state === "failed"))
      throw new Error("No verified Spotify track response; review the attempt before retrying");
    if (!enabled() || (await authorize(actor, owner)).ownerId !== owner)
      throw new Error("Release track lookup permission changed before save");
    const saved = receiptSchema.parse(
      await rpc("complete_context_release_track_isrcs", {
        p_owner: owner,
        p_request: requestId,
        p_subject: subjectId,
        p_release_result: release.sourceResultId,
        p_attempt: claim.attemptId,
        p_payload: collected,
      }),
    );
    return { ...saved, attemptId: claim.attemptId, releaseSourceResultId: release.sourceResultId };
  } catch (error) {
    // The provider call may have happened. Mark unknown and never retry silently.
    try {
      await rpc("fail_context_enrichment", { p_owner: owner, p_attempt: claim.attemptId });
    } catch {
      /* Keep the original error; the running claim still prevents another call. */
    }
    throw error;
  }
}
