import { v5 as uuidv5 } from "uuid";
import { authorizeContextOwner } from "@/lib/context/authorizeContextOwner";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { ContextNodeNeedsReconciliation } from "./ContextNodeNeedsReconciliation";
import { loadCurrentReleaseTrackSlots } from "./loadCurrentReleaseTrackSlots";
import { runRecordedContextModules } from "./runRecordedContextModules";
import { runReleaseTrackIsrcs } from "./runReleaseTrackIsrcs";

const policyVersion = "spotify-release-track-isrcs-v1";
const executionNamespace = "0cbed5e2-a3b1-44f2-b069-4a73d947a836";

type Dependencies = {
  authorize?: (actor: string, owner: string) => Promise<{ ownerId: string }>;
  rpc?: (name: string, params: Record<string, unknown>) => Promise<unknown>;
  record?: typeof runRecordedContextModules;
  collect?: typeof runReleaseTrackIsrcs;
};

/** One recorded node for the exact current release result. Never replay a claimed node. */
export async function runRecordedReleaseTrackIsrcs(
  actor: string,
  owner: string,
  requestId: string,
  subjectId: string,
  deps: Dependencies = {},
) {
  const enabled = () => process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED === "true";
  if (!enabled()) throw new Error("Spotify release track lookup is not enabled");
  const authorize =
    deps.authorize ??
    (async (account: string, selectedOwner: string) => {
      const access = await authorizeContextOwner(
        account,
        selectedOwner === account ? undefined : selectedOwner,
      );
      return { ownerId: access.ownerId };
    });
  const rpc = deps.rpc ?? callContextRpc;
  const read = () =>
    loadCurrentReleaseTrackSlots(actor, owner, requestId, subjectId, { authorize, rpc });
  const release = await read();
  if (release.slots.length < 1 || release.slots.length > 100)
    throw new Error("Release track lookup currently supports 1–100 positions");
  const key = `${subjectId}:spotify_release_track_isrcs`;
  const plan = [
    {
      key,
      subjectId,
      module: "spotify_release_track_isrcs",
      targetKind: "release",
      state: "ready_for_dispatch" as const,
      dependsOn: [],
      reasons: [],
      sourceResultId: release.sourceResultId,
      linkedSlots: release.slots.length,
    },
  ];
  const executionId = uuidv5(
    `${requestId}:${subjectId}:${release.sourceResultId}:${policyVersion}`,
    executionNamespace,
  );
  const check = async () => {
    if (!enabled()) throw new Error("Spotify release track lookup is not enabled");
    const current = await read();
    if (
      current.sourceResultId !== release.sourceResultId ||
      JSON.stringify(current.slots) !== JSON.stringify(release.slots)
    )
      throw new Error("Release track evidence changed");
  };
  const outcomes = await (deps.record ?? runRecordedContextModules)(
    { actor, owner, requestId, executionId, policyVersion, plan },
    {
      authorizeExecution: check,
      authorizeNode: async node => {
        if (node.key !== key) throw new Error("Unexpected release track node");
        await check();
      },
      dispatch: async node => {
        if (node.key !== key) throw new Error("Unexpected release track dispatch");
        const receipt = await (deps.collect ?? runReleaseTrackIsrcs)(
          actor,
          owner,
          requestId,
          subjectId,
          { authorize, rpc },
        );
        if (receipt.state === "unknown") throw new ContextNodeNeedsReconciliation();
        return receipt;
      },
    },
  );
  return { executionId, policyVersion, outcomes };
}
